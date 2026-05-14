"""
Graph-building service for the Constellation visualization.

Computes a node + edge payload describing a user's knowledge base: all
of their blobs, plus any bookmarks and questions connected to at least
one blob via BlobToObject.

Edges come in three kinds:

- ``direct``: one edge per BlobToObject row.
- ``tag``: per-node top-K most tag-similar neighbors.
- ``collection``: per-node top-K most collection-similar neighbors
  (opt-in).

If a pair is connected by a direct edge, any tag/collection edge for
the same pair is suppressed — the stronger semantic wins.

After edges are finalized, a community-detection pass (Louvain) assigns
each node a stable ``community`` id (or ``None`` for the gray bucket of
singletons / tiny clusters / overflow past ``MAX_COMMUNITIES``). The
frontend uses this id to pick a color from a fixed palette.
"""
from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

import networkx as nx
from networkx.algorithms.community import louvain_communities

from django.contrib.auth.models import User

from blob.models import Blob, BlobToObject
from bookmark.models import Bookmark
from collection.models import CollectionObject
from drill.models import Question
from tag.models import Tag

DEFAULT_TOP_K = 4

# Louvain edge weights — direct links are user-confirmed and should pull
# harder than the computed similarity edges, but we cap similarity weights
# so a heavily-shared-tag pair can't out-bind a direct link.
DIRECT_EDGE_LOUVAIN_WEIGHT = 4.0
SIMILARITY_EDGE_WEIGHT_CAP = 3.0

# Frontend palette has 10 slots; communities past this are bucketed as
# "unclustered" (community=None) along with anything below MIN_COMMUNITY_SIZE.
MAX_COMMUNITIES = 10
MIN_COMMUNITY_SIZE = 3

# Seed makes Louvain deterministic across runs with identical input.
LOUVAIN_SEED = 0

# Cluster labels are derived from member tags via TF-IDF. Up to LABELS_PER_COMMUNITY
# tag names are returned per cluster; a tag must appear on at least MIN_TAG_HITS
# members of the cluster to be considered (one stray tag shouldn't label a
# 50-node cluster).
LABELS_PER_COMMUNITY = 2
MIN_TAG_HITS = 2


def build_graph(user: User, layers: set[str], top_k: int = DEFAULT_TOP_K) -> dict[str, Any]:
    """Build the {nodes, edges} payload for the given user.

    Args:
        user: Owner of the knowledge base being visualized.
        layers: Set of edge layers to include. ``"direct"`` and
            ``"tags"`` are expected by default; ``"collections"`` is
            opt-in.
        top_k: Max tag / collection neighbors kept per node.

    Returns:
        A dict with ``nodes`` and ``edges`` lists suitable for JSON
        serialization.
    """
    # Collect nodes first so we can scope edge computation to them.
    nodes_by_uuid, node_records = _collect_nodes(user)

    # Tag membership powers both the tag-similarity edges (if that layer
    # is on) and the community labels (always). Computing it once and
    # threading it through avoids duplicate queries.
    members_by_tag = _members_by_tag(user, nodes_by_uuid)

    edges: list[dict[str, Any]] = []
    direct_pairs: set[frozenset[str]] = set()

    if "direct" in layers or not layers:
        # Direct is always included; the layers arg is a convenience.
        for edge, pair in _direct_edges(user, nodes_by_uuid):
            edges.append(edge)
            direct_pairs.add(pair)

    if "tags" in layers:
        edges.extend(
            _similarity_edges(
                kind="tag",
                pair_counts=_tag_pair_counts(members_by_tag, nodes_by_uuid),
                top_k=top_k,
                skip_pairs=direct_pairs,
            )
        )

    if "collections" in layers:
        edges.extend(
            _similarity_edges(
                kind="collection",
                pair_counts=_shared_collection_counts(user, nodes_by_uuid),
                top_k=top_k,
                skip_pairs=direct_pairs,
            )
        )

    # Compute degree once edges are final, then attach.
    degree: dict[str, int] = defaultdict(int)
    for edge in edges:
        degree[edge["source"]] += 1
        degree[edge["target"]] += 1

    communities = _assign_communities(node_records, edges)

    for record in node_records:
        record["degree"] = degree.get(record["uuid"], 0)
        record["community"] = communities.get(record["uuid"])

    community_labels = _label_communities(
        uuid_to_community=communities,
        members_by_tag=members_by_tag,
        total_nodes=len(node_records),
    )

    return {
        "nodes": node_records,
        "edges": edges,
        "community_labels": community_labels,
    }


def _assign_communities(
    node_records: list[dict[str, Any]],
    edges: list[dict[str, Any]],
) -> dict[str, int | None]:
    """Run Louvain over the edge list and return uuid → community id.

    Communities are sorted by size descending and renumbered 0..N. Anything
    smaller than ``MIN_COMMUNITY_SIZE`` or past ``MAX_COMMUNITIES`` maps to
    ``None`` (the unclustered bucket — rendered gray on the frontend).
    """
    uuid_to_community: dict[str, int | None] = {
        record["uuid"]: None for record in node_records
    }

    if not edges:
        return uuid_to_community

    graph = nx.Graph()
    graph.add_nodes_from(record["uuid"] for record in node_records)
    for edge in edges:
        weight = _louvain_weight(edge)
        # If the pair already has an edge (shouldn't happen post-dedup, but
        # be defensive), keep the stronger weight rather than summing.
        existing = graph.get_edge_data(edge["source"], edge["target"])
        if existing is None or existing.get("weight", 0) < weight:
            graph.add_edge(edge["source"], edge["target"], weight=weight)

    raw_communities = louvain_communities(graph, weight="weight", seed=LOUVAIN_SEED)

    # Sort by size desc, then by smallest member uuid for tie-break stability.
    sized = sorted(
        (frozenset(members) for members in raw_communities),
        key=lambda members: (-len(members), min(members)),
    )

    next_id = 0
    for members in sized:
        if len(members) < MIN_COMMUNITY_SIZE or next_id >= MAX_COMMUNITIES:
            continue
        for uuid_str in members:
            uuid_to_community[uuid_str] = next_id
        next_id += 1

    return uuid_to_community


def _louvain_weight(edge: dict[str, Any]) -> float:
    """Map an edge dict to the weight used by Louvain."""
    if edge["kind"] == "direct":
        return DIRECT_EDGE_LOUVAIN_WEIGHT
    return min(float(edge["weight"]), SIMILARITY_EDGE_WEIGHT_CAP)


def _label_communities(
    uuid_to_community: dict[str, int | None],
    members_by_tag: dict[int, list[str]],
    total_nodes: int,
) -> dict[str, list[str]]:
    """Pick the top tag names per community using TF-IDF over tag membership.

    A tag scores well for a cluster when it's frequent *within* the cluster
    (high term frequency) and uncommon *outside* it (high inverse document
    frequency). This excludes globally-common tags like "misc" from
    labelling every cluster, even if they happen to be the single most
    frequent tag inside one.

    Returns ``{str(community_id): [tag_name, ...]}`` with keys as strings
    so the dict serializes cleanly to JSON.
    """
    if total_nodes == 0 or not members_by_tag:
        return {}

    # community_id -> set of member uuids (only numbered communities, not None).
    community_members: dict[int, set[str]] = defaultdict(set)
    for uuid_str, community_id in uuid_to_community.items():
        if community_id is not None:
            community_members[community_id].add(uuid_str)

    if not community_members:
        return {}

    # IDF per tag: log(N / (1 + n_with_tag)). Tags everyone has go to ~0;
    # tags only a handful of nodes have stay high.
    idf_by_tag: dict[int, float] = {
        tag_id: math.log(total_nodes / (1 + len(set(members))))
        for tag_id, members in members_by_tag.items()
    }

    # Per-community TF-IDF ranking; collect the tag ids we'll need to
    # resolve into names afterward.
    ranked_by_community: dict[int, list[int]] = {}
    needed_tag_ids: set[int] = set()
    for community_id, members in community_members.items():
        scores: dict[int, float] = {}
        for tag_id, tag_members in members_by_tag.items():
            hits = sum(1 for member in tag_members if member in members)
            if hits < MIN_TAG_HITS:
                continue
            term_frequency = hits / len(members)
            scores[tag_id] = term_frequency * idf_by_tag[tag_id]
        if not scores:
            continue
        # Sort desc by score, tie-break by tag_id for determinism.
        ranked = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
        top_ids = [tag_id for tag_id, _ in ranked[:LABELS_PER_COMMUNITY]]
        ranked_by_community[community_id] = top_ids
        needed_tag_ids.update(top_ids)

    if not needed_tag_ids:
        return {}

    name_by_id = dict(
        Tag.objects.filter(id__in=needed_tag_ids).values_list("id", "name")
    )

    labels: dict[str, list[str]] = {}
    for community_id, tag_ids in ranked_by_community.items():
        names = [name_by_id[tid] for tid in tag_ids if tid in name_by_id]
        if names:
            labels[str(community_id)] = names
    return labels


def _collect_nodes(user: User) -> tuple[set[str], list[dict[str, Any]]]:
    """Return (uuid_set, ordered node records) for the user."""
    records: list[dict[str, Any]] = []
    uuids: set[str] = set()

    blobs = Blob.objects.filter(user=user).only(
        "uuid", "name", "file", "importance"
    )
    for blob in blobs:
        uuid_str = str(blob.uuid)
        uuids.add(uuid_str)
        records.append(
            {
                "uuid": uuid_str,
                "type": "blob",
                "name": blob.name or "",
                "thumbnail_url": blob.cover_url_small,
                "detail_url": f"/blob/{uuid_str}/",
                "importance": blob.importance,
            }
        )

    # Bookmarks / questions only count if they're linked from at least one
    # of the user's BlobToObject rows.
    linked_bookmark_ids = (
        BlobToObject.objects.filter(node__user=user, bookmark__isnull=False)
        .values_list("bookmark_id", flat=True)
        .distinct()
    )
    for bookmark in Bookmark.objects.filter(id__in=linked_bookmark_ids).only(
        "uuid", "name"
    ):
        uuid_str = str(bookmark.uuid)
        uuids.add(uuid_str)
        records.append(
            {
                "uuid": uuid_str,
                "type": "bookmark",
                "name": bookmark.name or "",
                "detail_url": f"/bookmark/{uuid_str}/",
            }
        )

    linked_question_ids = (
        BlobToObject.objects.filter(node__user=user, question__isnull=False)
        .values_list("question_id", flat=True)
        .distinct()
    )
    for question in Question.objects.filter(id__in=linked_question_ids).only(
        "uuid", "question"
    ):
        uuid_str = str(question.uuid)
        uuids.add(uuid_str)
        records.append(
            {
                "uuid": uuid_str,
                "type": "question",
                "name": _question_label(question),
                "detail_url": f"/drill/question/{uuid_str}/",
            }
        )

    return uuids, records


def _question_label(question: Any) -> str:
    """Best-effort short label for a question."""
    text = getattr(question, "question", "") or ""
    return text[:120]


def _direct_edges(
    user: User, node_uuids: set[str]
) -> list[tuple[dict[str, Any], frozenset[str]]]:
    """Return (edge_dict, pair_frozenset) for every BlobToObject row."""
    rows = BlobToObject.objects.filter(node__user=user).select_related(
        "node", "blob", "bookmark", "question"
    )
    edges: list[tuple[dict[str, Any], frozenset[str]]] = []
    for row in rows:
        source_uuid = str(row.node.uuid)
        target_uuid = _resolve_target_uuid(row)
        if target_uuid is None:
            continue
        if source_uuid not in node_uuids or target_uuid not in node_uuids:
            continue
        if source_uuid == target_uuid:
            continue
        edges.append(
            (
                {
                    "source": source_uuid,
                    "target": target_uuid,
                    "kind": "direct",
                    "weight": 1,
                },
                frozenset((source_uuid, target_uuid)),
            )
        )
    return edges


def _resolve_target_uuid(row: BlobToObject) -> str | None:
    """Pull whichever of blob/bookmark/question is set on the row."""
    if row.blob_id is not None and row.blob is not None:
        return str(row.blob.uuid)
    if row.bookmark_id is not None and row.bookmark is not None:
        return str(row.bookmark.uuid)
    if row.question_id is not None and row.question is not None:
        return str(row.question.uuid)
    return None


def _members_by_tag(
    user: User, node_uuids: set[str]
) -> dict[int, list[str]]:
    """Merge tag membership across blobs, bookmarks, and questions.

    Returns ``tag_id -> list of member uuids`` scoped to nodes that are
    actually in the graph. Used by both the tag-similarity edge layer
    and the community labeller, so we only pay the queries once.
    """
    merged: dict[int, list[str]] = defaultdict(list)
    for mapping in (
        _members_by_tag_for_blobs(user),
        _members_by_tag_for_bookmarks(user),
        _members_by_tag_for_questions(user),
    ):
        for tag_id, members in mapping.items():
            merged[tag_id].extend(m for m in members if m in node_uuids)
    return merged


def _tag_pair_counts(
    members_by_tag: dict[int, list[str]], node_uuids: set[str]
) -> dict[frozenset[str], int]:
    """For every pair of nodes that share a tag, count how many tags they share.

    ``node_uuids`` is accepted for symmetry with the collection-counts
    helper; ``members_by_tag`` is already scoped to the graph in
    ``_members_by_tag``, so the parameter is currently unused but kept
    in the signature so callers stay parallel.
    """
    del node_uuids  # kept for signature parity; see docstring.
    counts: dict[frozenset[str], int] = defaultdict(int)
    for members in members_by_tag.values():
        for i, a in enumerate(members):
            for b in members[i + 1 :]:
                if a == b:
                    continue
                counts[frozenset((a, b))] += 1
    return counts


def _members_by_tag_for_blobs(user: User) -> dict[int, list[str]]:
    members: dict[int, list[str]] = defaultdict(list)
    rows = (
        Blob.tags.through.objects.filter(blob__user=user)
        .values_list("tag_id", "blob__uuid")
    )
    for tag_id, blob_uuid in rows:
        members[tag_id].append(str(blob_uuid))
    return members


def _members_by_tag_for_bookmarks(user: User) -> dict[int, list[str]]:
    members: dict[int, list[str]] = defaultdict(list)
    rows = (
        Bookmark.tags.through.objects.filter(bookmark__user=user)
        .values_list("tag_id", "bookmark__uuid")
    )
    for tag_id, uuid_val in rows:
        members[tag_id].append(str(uuid_val))
    return members


def _members_by_tag_for_questions(user: User) -> dict[int, list[str]]:
    members: dict[int, list[str]] = defaultdict(list)
    rows = (
        Question.tags.through.objects.filter(question__user=user)
        .values_list("tag_id", "question__uuid")
    )
    for tag_id, uuid_val in rows:
        members[tag_id].append(str(uuid_val))
    return members


def _shared_collection_counts(
    user: User, node_uuids: set[str]
) -> dict[frozenset[str], int]:
    """Count how many Collections each pair of objects co-appears in."""
    counts: dict[frozenset[str], int] = defaultdict(int)
    members_by_collection: dict[int, list[str]] = defaultdict(list)

    rows = (
        CollectionObject.objects.filter(collection__user=user)
        .values_list("collection_id", "blob__uuid", "bookmark__uuid")
    )
    for collection_id, blob_uuid, bookmark_uuid in rows:
        target_uuid = str(blob_uuid) if blob_uuid else str(bookmark_uuid) if bookmark_uuid else None
        if target_uuid is None:
            continue
        if target_uuid not in node_uuids:
            continue
        members_by_collection[collection_id].append(target_uuid)

    for members in members_by_collection.values():
        for i, a in enumerate(members):
            for b in members[i + 1 :]:
                if a == b:
                    continue
                counts[frozenset((a, b))] += 1

    return counts


def _similarity_edges(
    kind: str,
    pair_counts: dict[frozenset[str], int],
    top_k: int,
    skip_pairs: set[frozenset[str]],
) -> list[dict[str, Any]]:
    """Turn pair-count map into a deduped top-K-per-node edge list."""
    if not pair_counts:
        return []

    neighbors: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for pair, count in pair_counts.items():
        if pair in skip_pairs:
            continue
        a, b = tuple(pair)
        neighbors[a].append((count, b))
        neighbors[b].append((count, a))

    kept_pairs: set[frozenset[str]] = set()
    for node_uuid, partner_list in neighbors.items():
        # Top K by count desc; ties broken by partner uuid for determinism.
        partner_list.sort(key=lambda pair: (-pair[0], pair[1]))
        for count, partner in partner_list[:top_k]:
            pair = frozenset((node_uuid, partner))
            kept_pairs.add(pair)

    edges: list[dict[str, Any]] = []
    for pair in sorted(kept_pairs, key=lambda p: sorted(p)):
        a, b = sorted(pair)
        edges.append(
            {
                "source": a,
                "target": b,
                "kind": kind,
                "weight": pair_counts[pair],
            }
        )
    return edges
