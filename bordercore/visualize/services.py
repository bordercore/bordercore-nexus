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
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from django.contrib.auth.models import User

from blob.models import Blob, BlobToObject
from bookmark.models import Bookmark
from collection.models import CollectionObject
from drill.models import Question

DEFAULT_TOP_K = 4


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
                pair_counts=_shared_tag_counts(user, nodes_by_uuid),
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

    for record in node_records:
        record["degree"] = degree.get(record["uuid"], 0)

    return {"nodes": node_records, "edges": edges}


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


def _shared_tag_counts(
    user: User, node_uuids: set[str]
) -> dict[frozenset[str], int]:
    """For every pair of user-owned objects that share a tag, count shared tags."""
    counts: dict[frozenset[str], int] = defaultdict(int)

    blob_tag_members = _members_by_tag_for_blobs(user)
    bookmark_tag_members = _members_by_tag_for_bookmarks(user)
    question_tag_members = _members_by_tag_for_questions(user)

    all_tag_members: dict[int, list[str]] = defaultdict(list)
    for mapping in (blob_tag_members, bookmark_tag_members, question_tag_members):
        for tag_id, members in mapping.items():
            all_tag_members[tag_id].extend(members)

    for members in all_tag_members.values():
        scoped = [m for m in members if m in node_uuids]
        for i, a in enumerate(scoped):
            for b in scoped[i + 1 :]:
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
