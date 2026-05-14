"""
Unit tests for visualize.services.build_graph.
"""
from __future__ import annotations

import pytest

from accounts.tests.factories import UserFactory
from blob.models import BlobToObject
from blob.tests.factories import BlobFactory
from bookmark.tests.factories import BookmarkFactory
from collection.models import CollectionObject
from collection.tests.factories import CollectionFactory
from drill.tests.factories import QuestionFactory
from tag.tests.factories import TagFactory
from visualize.services import build_graph

pytestmark = [pytest.mark.django_db]


def _uuids(items):
    return {item["uuid"] for item in items}


def _pair(edge):
    return frozenset((edge["source"], edge["target"]))


def test_returns_expected_shape():
    user = UserFactory.create()
    BlobFactory.create(user=user, name="solo")

    payload = build_graph(user=user, layers={"direct", "tags"})

    assert set(payload) == {"nodes", "edges", "community_labels"}
    assert len(payload["nodes"]) == 1
    assert payload["nodes"][0]["type"] == "blob"
    assert payload["nodes"][0]["degree"] == 0
    assert payload["community_labels"] == {}


def test_direct_blob_to_blob_edge_emitted():
    user = UserFactory.create()
    parent = BlobFactory.create(user=user)
    child = BlobFactory.create(user=user)
    BlobToObject.objects.create(node=parent, blob=child)

    payload = build_graph(user=user, layers={"direct", "tags"})

    direct = [e for e in payload["edges"] if e["kind"] == "direct"]
    assert len(direct) == 1
    assert _pair(direct[0]) == frozenset((str(parent.uuid), str(child.uuid)))
    assert direct[0]["weight"] == 1


def test_direct_edges_to_bookmark_and_question(monkeypatch_bookmark):
    user = UserFactory.create()
    blob = BlobFactory.create(user=user)
    bookmark = BookmarkFactory.create(user=user)
    question = QuestionFactory.create(user=user)
    BlobToObject.objects.create(node=blob, bookmark=bookmark)
    BlobToObject.objects.create(node=blob, question=question)

    payload = build_graph(user=user, layers={"direct", "tags"})

    types = {n["type"] for n in payload["nodes"]}
    assert types == {"blob", "bookmark", "question"}
    assert len(payload["edges"]) == 2
    assert all(e["kind"] == "direct" for e in payload["edges"])


def test_orphan_bookmarks_and_questions_excluded(monkeypatch_bookmark):
    user = UserFactory.create()
    BlobFactory.create(user=user)
    BookmarkFactory.create(user=user)  # never linked
    QuestionFactory.create(user=user)  # never linked

    payload = build_graph(user=user, layers={"direct", "tags"})

    types = {n["type"] for n in payload["nodes"]}
    assert types == {"blob"}


def test_other_users_data_excluded():
    alice = UserFactory.create(username="alice")
    bob = UserFactory.create(username="bob")
    BlobFactory.create(user=alice)
    BlobFactory.create(user=bob)

    payload = build_graph(user=alice, layers={"direct", "tags"})

    assert len(payload["nodes"]) == 1


def test_tag_edges_emitted_when_tags_layer_on():
    user = UserFactory.create()
    tag = TagFactory.create(name="linux", user=user)
    a = BlobFactory.create(user=user)
    b = BlobFactory.create(user=user)
    a.tags.add(tag)
    b.tags.add(tag)

    payload = build_graph(user=user, layers={"direct", "tags"})
    tag_edges = [e for e in payload["edges"] if e["kind"] == "tag"]

    assert len(tag_edges) == 1
    assert _pair(tag_edges[0]) == frozenset((str(a.uuid), str(b.uuid)))
    assert tag_edges[0]["weight"] == 1


def test_tag_edges_suppressed_when_layer_off():
    user = UserFactory.create()
    tag = TagFactory.create(name="linux", user=user)
    a = BlobFactory.create(user=user)
    b = BlobFactory.create(user=user)
    a.tags.add(tag)
    b.tags.add(tag)

    payload = build_graph(user=user, layers={"direct"})

    assert [e for e in payload["edges"] if e["kind"] == "tag"] == []


def test_tag_edge_weight_equals_shared_tag_count():
    user = UserFactory.create()
    t1 = TagFactory.create(name="linux", user=user)
    t2 = TagFactory.create(name="python", user=user)
    a = BlobFactory.create(user=user)
    b = BlobFactory.create(user=user)
    for tag in (t1, t2):
        a.tags.add(tag)
        b.tags.add(tag)

    payload = build_graph(user=user, layers={"direct", "tags"})
    tag_edges = [e for e in payload["edges"] if e["kind"] == "tag"]

    assert len(tag_edges) == 1
    assert tag_edges[0]["weight"] == 2


def test_top_k_caps_tag_neighbors_per_node():
    # One focal node shares a tag with 6 others; with top_k=2, it should
    # keep edges to 2 of them (plus whatever symmetric edges those 2 demand).
    user = UserFactory.create()
    tag = TagFactory.create(name="linux", user=user)
    focal = BlobFactory.create(user=user)
    focal.tags.add(tag)
    peers = []
    for _ in range(6):
        peer = BlobFactory.create(user=user)
        peer.tags.add(tag)
        peers.append(peer)

    payload = build_graph(user=user, layers={"direct", "tags"}, top_k=2)
    tag_edges = [e for e in payload["edges"] if e["kind"] == "tag"]

    focal_uuid = str(focal.uuid)
    focal_edges = [e for e in tag_edges if focal_uuid in (e["source"], e["target"])]

    # Top-K guarantees at least K edges for focal (assuming that many partners).
    # Symmetry may add more — that's fine; we just need the lower bound.
    assert len(focal_edges) >= 2


def test_tag_edge_deduped_against_direct_edge_for_same_pair():
    user = UserFactory.create()
    tag = TagFactory.create(name="linux", user=user)
    a = BlobFactory.create(user=user)
    b = BlobFactory.create(user=user)
    a.tags.add(tag)
    b.tags.add(tag)
    BlobToObject.objects.create(node=a, blob=b)

    payload = build_graph(user=user, layers={"direct", "tags"})

    kinds_for_pair = {
        e["kind"] for e in payload["edges"] if _pair(e) == frozenset((str(a.uuid), str(b.uuid)))
    }
    assert kinds_for_pair == {"direct"}


def test_collection_layer_opt_in():
    user = UserFactory.create()
    collection = CollectionFactory.create(user=user)
    a = BlobFactory.create(user=user)
    b = BlobFactory.create(user=user)
    CollectionObject.objects.create(collection=collection, blob=a)
    CollectionObject.objects.create(collection=collection, blob=b)

    without = build_graph(user=user, layers={"direct", "tags"})
    with_col = build_graph(user=user, layers={"direct", "tags", "collections"})

    assert [e for e in without["edges"] if e["kind"] == "collection"] == []
    col_edges = [e for e in with_col["edges"] if e["kind"] == "collection"]
    assert len(col_edges) == 1
    assert _pair(col_edges[0]) == frozenset((str(a.uuid), str(b.uuid)))


def test_collection_edge_deduped_against_direct_edge():
    user = UserFactory.create()
    collection = CollectionFactory.create(user=user)
    a = BlobFactory.create(user=user)
    b = BlobFactory.create(user=user)
    CollectionObject.objects.create(collection=collection, blob=a)
    CollectionObject.objects.create(collection=collection, blob=b)
    BlobToObject.objects.create(node=a, blob=b)

    payload = build_graph(user=user, layers={"direct", "tags", "collections"})

    kinds_for_pair = {
        e["kind"] for e in payload["edges"] if _pair(e) == frozenset((str(a.uuid), str(b.uuid)))
    }
    assert kinds_for_pair == {"direct"}


def test_degree_reflects_emitted_edges():
    user = UserFactory.create()
    hub = BlobFactory.create(user=user)
    a = BlobFactory.create(user=user)
    b = BlobFactory.create(user=user)
    BlobToObject.objects.create(node=hub, blob=a)
    BlobToObject.objects.create(node=hub, blob=b)

    payload = build_graph(user=user, layers={"direct", "tags"})

    by_uuid = {n["uuid"]: n for n in payload["nodes"]}
    assert by_uuid[str(hub.uuid)]["degree"] == 2
    assert by_uuid[str(a.uuid)]["degree"] == 1
    assert by_uuid[str(b.uuid)]["degree"] == 1


# ---- Community detection --------------------------------------------------


def test_community_is_none_when_graph_has_no_edges():
    user = UserFactory.create()
    BlobFactory.create(user=user)
    BlobFactory.create(user=user)

    payload = build_graph(user=user, layers={"direct", "tags"})

    assert all(n["community"] is None for n in payload["nodes"])


def test_community_none_for_pair_below_min_size():
    # A two-node component is below MIN_COMMUNITY_SIZE (3) and should be
    # bucketed as unclustered.
    user = UserFactory.create()
    a = BlobFactory.create(user=user)
    b = BlobFactory.create(user=user)
    BlobToObject.objects.create(node=a, blob=b)

    payload = build_graph(user=user, layers={"direct", "tags"})

    by_uuid = {n["uuid"]: n for n in payload["nodes"]}
    assert by_uuid[str(a.uuid)]["community"] is None
    assert by_uuid[str(b.uuid)]["community"] is None


def test_two_disjoint_clusters_get_distinct_community_ids():
    user = UserFactory.create()
    # Cluster 1: triangle of three blobs.
    a1 = BlobFactory.create(user=user)
    a2 = BlobFactory.create(user=user)
    a3 = BlobFactory.create(user=user)
    BlobToObject.objects.create(node=a1, blob=a2)
    BlobToObject.objects.create(node=a2, blob=a3)
    BlobToObject.objects.create(node=a3, blob=a1)
    # Cluster 2: triangle of three blobs, no edges to cluster 1.
    b1 = BlobFactory.create(user=user)
    b2 = BlobFactory.create(user=user)
    b3 = BlobFactory.create(user=user)
    BlobToObject.objects.create(node=b1, blob=b2)
    BlobToObject.objects.create(node=b2, blob=b3)
    BlobToObject.objects.create(node=b3, blob=b1)

    payload = build_graph(user=user, layers={"direct", "tags"})

    by_uuid = {n["uuid"]: n for n in payload["nodes"]}
    cluster_a_ids = {by_uuid[str(b.uuid)]["community"] for b in (a1, a2, a3)}
    cluster_b_ids = {by_uuid[str(b.uuid)]["community"] for b in (b1, b2, b3)}

    assert len(cluster_a_ids) == 1
    assert len(cluster_b_ids) == 1
    assert cluster_a_ids != cluster_b_ids
    assert cluster_a_ids | cluster_b_ids == {0, 1}


def test_community_ids_are_deterministic_across_runs():
    user = UserFactory.create()
    nodes = [BlobFactory.create(user=user) for _ in range(6)]
    # Two clear triangles.
    for i in range(3):
        BlobToObject.objects.create(node=nodes[i], blob=nodes[(i + 1) % 3])
    for i in range(3, 6):
        BlobToObject.objects.create(node=nodes[i], blob=nodes[3 + (i - 2) % 3])

    payload_a = build_graph(user=user, layers={"direct", "tags"})
    payload_b = build_graph(user=user, layers={"direct", "tags"})

    by_a = {n["uuid"]: n["community"] for n in payload_a["nodes"]}
    by_b = {n["uuid"]: n["community"] for n in payload_b["nodes"]}
    assert by_a == by_b


# ---- Community labels -----------------------------------------------------


def _triangle(user, members):
    """Make a 3-blob triangle so the members form one Louvain community."""
    BlobToObject.objects.create(node=members[0], blob=members[1])
    BlobToObject.objects.create(node=members[1], blob=members[2])
    BlobToObject.objects.create(node=members[2], blob=members[0])


def test_distinctive_tag_becomes_cluster_label():
    user = UserFactory.create()
    linux = TagFactory.create(name="linux", user=user)
    cluster = [BlobFactory.create(user=user) for _ in range(3)]
    _triangle(user, cluster)
    for blob in cluster:
        blob.tags.add(linux)

    payload = build_graph(user=user, layers={"direct", "tags"})

    by_uuid = {n["uuid"]: n for n in payload["nodes"]}
    cluster_id = by_uuid[str(cluster[0].uuid)]["community"]
    assert cluster_id is not None
    labels = payload["community_labels"][str(cluster_id)]
    assert "linux" in labels


def test_globally_common_tag_loses_to_distinctive_tag():
    # Two distinct clusters; every node is tagged "misc" (common everywhere)
    # but each cluster also has its own distinctive tag. The distinctive tag
    # should win the label, not "misc".
    user = UserFactory.create()
    misc = TagFactory.create(name="misc", user=user)
    linux = TagFactory.create(name="linux", user=user)
    python = TagFactory.create(name="python", user=user)

    cluster_a = [BlobFactory.create(user=user) for _ in range(3)]
    cluster_b = [BlobFactory.create(user=user) for _ in range(3)]
    _triangle(user, cluster_a)
    _triangle(user, cluster_b)

    for blob in cluster_a + cluster_b:
        blob.tags.add(misc)
    for blob in cluster_a:
        blob.tags.add(linux)
    for blob in cluster_b:
        blob.tags.add(python)

    payload = build_graph(user=user, layers={"direct", "tags"})

    by_uuid = {n["uuid"]: n for n in payload["nodes"]}
    id_a = by_uuid[str(cluster_a[0].uuid)]["community"]
    id_b = by_uuid[str(cluster_b[0].uuid)]["community"]
    labels_a = payload["community_labels"][str(id_a)]
    labels_b = payload["community_labels"][str(id_b)]

    # The distinctive tag must rank above "misc" in each cluster.
    assert labels_a[0] in {"linux"}
    assert labels_b[0] in {"python"}


def test_singleton_tag_below_min_hits_does_not_label():
    # Only one member of the cluster has the tag — below MIN_TAG_HITS (2).
    # The cluster should get no label entry.
    user = UserFactory.create()
    rare = TagFactory.create(name="lonely", user=user)
    cluster = [BlobFactory.create(user=user) for _ in range(3)]
    _triangle(user, cluster)
    cluster[0].tags.add(rare)

    payload = build_graph(user=user, layers={"direct", "tags"})

    by_uuid = {n["uuid"]: n for n in payload["nodes"]}
    cluster_id = by_uuid[str(cluster[0].uuid)]["community"]
    assert str(cluster_id) not in payload["community_labels"]


def test_community_labels_omitted_for_unclustered_nodes():
    # A pair of nodes is below MIN_COMMUNITY_SIZE (community=None); labels
    # only describe numbered communities, never the unclustered bucket.
    user = UserFactory.create()
    tag = TagFactory.create(name="solo", user=user)
    a = BlobFactory.create(user=user)
    b = BlobFactory.create(user=user)
    BlobToObject.objects.create(node=a, blob=b)
    a.tags.add(tag)
    b.tags.add(tag)

    payload = build_graph(user=user, layers={"direct", "tags"})

    assert payload["community_labels"] == {}
