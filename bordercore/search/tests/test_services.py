import uuid
from unittest.mock import patch

import pytest

from django.http import QueryDict

from search.services import (
    _build_pagination_dict,
    _filter_results,
    _get_aggregations,
    perform_search,
)

pytestmark = [pytest.mark.django_db]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_hit(doctype="note", name="Test", score=1.0, **extra_source):
    """Build a fake Elasticsearch hit dict."""
    source = {
        "uuid": str(uuid.uuid4()),
        "doctype": doctype,
        "name": name,
        "last_modified": "2025-08-01T17:04:23.788834-04:00",
        "tags": [],
        "importance": 1,
        **extra_source,
    }
    return {"_score": score, "_source": source, "_id": str(uuid.uuid4())}


def _make_es_response(hits=None, aggregations=None):
    """Build a fake Elasticsearch response dict."""
    return {
        "hits": {
            "total": {"value": len(hits) if hits else 0},
            "hits": hits or [],
        },
        "aggregations": aggregations or {},
    }


def _query_dict(params: dict) -> QueryDict:
    """Build a Django QueryDict from a plain dict.

    Supports list values for multi-valued keys (e.g. tags).
    """
    qd = QueryDict(mutable=True)
    for key, value in params.items():
        if isinstance(value, list):
            qd.setlist(key, value)
        else:
            qd[key] = value
    return qd


# ---------------------------------------------------------------------------
# _build_pagination_dict
# ---------------------------------------------------------------------------


class TestBuildPaginationDict:

    def test_zero_results_returns_empty(self):
        assert _build_pagination_dict(1, 0) == {}

    def test_single_page(self):
        result = _build_pagination_dict(1, 5)
        assert result["page_number"] == 1
        assert result["num_pages"] == 1
        assert result["total_results"] == 5
        assert result["has_previous"] is False
        assert result["has_next"] is False

    def test_multiple_pages_first_page(self):
        result = _build_pagination_dict(1, 25)
        assert result["num_pages"] == 3
        assert result["has_previous"] is False
        assert result["has_next"] is True
        assert result["next_page_number"] == 2

    def test_multiple_pages_middle_page(self):
        result = _build_pagination_dict(2, 25)
        assert result["has_previous"] is True
        assert result["has_next"] is True
        assert result["previous_page_number"] == 1
        assert result["next_page_number"] == 3

    def test_multiple_pages_last_page(self):
        result = _build_pagination_dict(3, 25)
        assert result["has_previous"] is True
        assert result["has_next"] is False

    def test_range_is_list(self):
        result = _build_pagination_dict(1, 100)
        assert isinstance(result["range"], list)


# ---------------------------------------------------------------------------
# _get_aggregations
# ---------------------------------------------------------------------------


class TestGetAggregations:

    def test_extracts_buckets(self):
        es_results = {
            "aggregations": {
                "Doctype Filter": {
                    "buckets": [
                        {"key": "note", "doc_count": 10},
                        {"key": "bookmark", "doc_count": 5},
                    ]
                }
            }
        }
        result = _get_aggregations(es_results, "Doctype Filter")
        assert result == [
            {"doctype": "note", "count": 10},
            {"doctype": "bookmark", "count": 5},
        ]

    def test_empty_buckets(self):
        es_results = {
            "aggregations": {
                "Doctype Filter": {"buckets": []}
            }
        }
        assert _get_aggregations(es_results, "Doctype Filter") == []


# ---------------------------------------------------------------------------
# _filter_results
# ---------------------------------------------------------------------------


class TestFilterResults:

    def test_renames_source_and_score(self):
        hits = [_make_hit()]
        _filter_results(hits, None)
        assert "source" in hits[0]
        assert "_source" not in hits[0]
        assert "score" in hits[0]
        assert "_score" not in hits[0]

    def test_adds_url_field(self):
        hits = [_make_hit(doctype="note")]
        _filter_results(hits, None)
        assert hits[0]["source"]["url"] != ""

    def test_adds_last_modified(self):
        hits = [_make_hit()]
        _filter_results(hits, None)
        # get_relative_date returns a human-readable string
        assert isinstance(hits[0]["source"]["last_modified"], str)

    def test_adds_tags_json(self):
        hits = [_make_hit(tags=["python", "django"])]
        _filter_results(hits, None)
        assert hits[0]["tags_json"] == '["python", "django"]'

    def test_tags_json_empty_when_no_tags(self):
        hit = _make_hit()
        del hit["_source"]["tags"]
        hits = [hit]
        _filter_results(hits, None)
        assert hits[0]["tags_json"] == "[]"

    def test_renames_attachment_content_highlight(self):
        hit = _make_hit()
        hit["highlight"] = {"attachment.content": ["matched text"]}
        _filter_results([hit], None)
        assert "attachment_content" in hit["highlight"]
        assert "attachment.content" not in hit["highlight"]

    def test_highlight_not_present(self):
        """No error when highlight key is absent."""
        hit = _make_hit()
        _filter_results([hit], None)
        assert "highlight" not in hit

    def test_search_term_highlight_in_contents(self):
        hit = _make_hit(contents="hello world")
        _filter_results([hit], "world")
        assert "*world*" in hit["source"]["contents"]

    def test_search_term_highlight_is_case_insensitive(self):
        hit = _make_hit(contents="Hello World")
        _filter_results([hit], "world")
        # Matches case-insensitively while preserving the matched text's case.
        assert "*World*" in hit["source"]["contents"]

    def test_search_term_highlight_is_word_bounded(self):
        hit = _make_hit(contents="category")
        _filter_results([hit], "cat")
        # "cat" inside "category" must not be italicized.
        assert "*" not in hit["source"]["contents"]

    def test_drill_question_rendered_as_markdown(self):
        hit = _make_hit(doctype="drill", question="**bold**")
        _filter_results([hit], None)
        assert "<strong>" in hit["source"]["question"]

    def test_todo_name_rendered_as_markdown(self):
        hit = _make_hit(doctype="todo", name="**bold task**")
        _filter_results([hit], None)
        assert "<strong>" in hit["source"]["name"]

    def test_cover_url_added_for_blob(self):
        hit = _make_hit(doctype="blob", filename="test.pdf")
        _filter_results([hit], None)
        assert "cover_url" in hit["source"]

    def test_missing_last_modified_does_not_raise(self):
        """A document missing last_modified must not 500 the search."""
        hit = _make_hit()
        del hit["_source"]["last_modified"]
        _filter_results([hit], None)
        # get_relative_date(None) still yields a string; no KeyError raised.
        assert isinstance(hit["source"]["last_modified"], str)

    def test_missing_doctype_does_not_raise(self):
        """A document missing doctype must not 500 the search."""
        hit = _make_hit()
        del hit["_source"]["doctype"]
        _filter_results([hit], None)
        # Unknown doctype yields no link and no cover, but processing succeeds.
        assert hit["source"]["url"] == ""
        assert "cover_url" not in hit["source"]


# ---------------------------------------------------------------------------
# perform_search
# ---------------------------------------------------------------------------


class TestPerformSearch:

    @patch("search.services.execute_search")
    def test_basic_term_search(self, mock_execute, authenticated_client):
        user, _ = authenticated_client()
        mock_execute.return_value = _make_es_response(
            hits=[_make_hit(doctype="note", name="My Note")],
            aggregations={"Doctype Filter": {"buckets": [{"key": "note", "doc_count": 1}]}},
        )

        params = _query_dict({"term_search": "My Note"})
        result = perform_search(user, params)

        assert result["count"] == 1
        assert len(result["results"]) == 1
        assert result["results"][0]["source"]["name"] == "My Note"
        assert result["aggregations"] == [{"doctype": "note", "count": 1}]

    @patch("search.services.execute_search")
    def test_returns_empty_on_request_error(self, mock_execute, authenticated_client):
        from elasticsearch import RequestError

        user, _ = authenticated_client()
        mock_execute.side_effect = RequestError(400, "error", {})

        params = _query_dict({"term_search": "bad query"})
        result = perform_search(user, params)

        assert result["count"] == 0
        assert result["results"] == []
        assert result["aggregations"] == []
        assert result["paginator"] == {}

    @patch("search.services.execute_search")
    def test_doctype_filter(self, mock_execute, authenticated_client):
        user, _ = authenticated_client()
        mock_execute.return_value = _make_es_response(
            hits=[_make_hit(doctype="bookmark", name="Link", url="https://example.com")],
            aggregations={"Doctype Filter": {"buckets": [{"key": "bookmark", "doc_count": 1}]}},
        )

        params = _query_dict({"term_search": "link", "doctype": "bookmark"})
        result = perform_search(user, params)

        # Verify post_filter was applied
        call_args = mock_execute.call_args[0][0]
        assert call_args["post_filter"] == {"term": {"doctype": "bookmark"}}
        assert result["count"] == 1

    @patch("search.services.execute_search")
    def test_tag_filter(self, mock_execute, authenticated_client):
        user, _ = authenticated_client()
        mock_execute.return_value = _make_es_response(
            hits=[],
            aggregations={"Doctype Filter": {"buckets": []}},
        )

        params = _query_dict({"term_search": "test", "tags": ["python", "django"]})
        result = perform_search(user, params)

        call_args = mock_execute.call_args[0][0]
        must_clauses = call_args["query"]["function_score"]["query"]["bool"]["must"]
        tag_clauses = [c for c in must_clauses if "term" in c and "tags.keyword" in c["term"]]
        assert len(tag_clauses) == 2

    @patch("search.services.execute_search")
    def test_exact_match(self, mock_execute, authenticated_client):
        user, _ = authenticated_client()
        mock_execute.return_value = _make_es_response(
            hits=[],
            aggregations={"Doctype Filter": {"buckets": []}},
        )

        params = _query_dict({"term_search": "exact phrase", "exact_match": "Yes"})
        perform_search(user, params)

        call_args = mock_execute.call_args[0][0]
        must_clauses = call_args["query"]["function_score"]["query"]["bool"]["must"]
        multi_match = next(c["multi_match"] for c in must_clauses if "multi_match" in c)
        assert multi_match["type"] == "phrase"

    @patch("search.services.execute_search")
    def test_best_fields_by_default(self, mock_execute, authenticated_client):
        user, _ = authenticated_client()
        mock_execute.return_value = _make_es_response(
            hits=[],
            aggregations={"Doctype Filter": {"buckets": []}},
        )

        params = _query_dict({"term_search": "something"})
        perform_search(user, params)

        call_args = mock_execute.call_args[0][0]
        must_clauses = call_args["query"]["function_score"]["query"]["bool"]["must"]
        multi_match = next(c["multi_match"] for c in must_clauses if "multi_match" in c)
        assert multi_match["type"] == "best_fields"

    @patch("search.services.execute_search")
    def test_sort_field(self, mock_execute, authenticated_client):
        user, _ = authenticated_client()
        mock_execute.return_value = _make_es_response(
            hits=[],
            aggregations={"Doctype Filter": {"buckets": []}},
        )

        params = _query_dict({"term_search": "test", "sort": "_score"})
        perform_search(user, params)

        call_args = mock_execute.call_args[0][0]
        assert call_args["sort"] == {"_score": {"order": "desc"}}

    @patch("search.services.execute_search")
    def test_pagination_offset(self, mock_execute, authenticated_client):
        user, _ = authenticated_client()
        mock_execute.return_value = _make_es_response(
            hits=[],
            aggregations={"Doctype Filter": {"buckets": []}},
        )

        params = _query_dict({"term_search": "test", "page": "3"})
        perform_search(user, params)

        call_args = mock_execute.call_args[0][0]
        assert call_args["from_"] == 20  # (3-1) * 10

    @patch("search.services.execute_search")
    def test_paginator_in_response(self, mock_execute, authenticated_client):
        user, _ = authenticated_client()
        mock_execute.return_value = _make_es_response(
            hits=[_make_hit() for _ in range(10)],
            aggregations={"Doctype Filter": {"buckets": []}},
        )
        # Fake a total count > 10 to get multi-page paginator
        mock_execute.return_value["hits"]["total"]["value"] = 25

        params = _query_dict({"term_search": "test"})
        result = perform_search(user, params)

        assert result["paginator"]["num_pages"] == 3
        assert result["paginator"]["page_number"] == 1

    @patch("search.services.len_safe_get_embedding")
    @patch("search.services.execute_search")
    def test_semantic_search(self, mock_execute, mock_embedding, authenticated_client):
        user, _ = authenticated_client()
        mock_embedding.return_value = [0.1] * 10
        mock_execute.return_value = _make_es_response(
            hits=[_make_hit(doctype="note", name="Semantic Result")],
            aggregations={"Doctype Filter": {"buckets": [{"key": "note", "doc_count": 1}]}},
        )

        params = _query_dict({"semantic_search": "meaning of life"})
        result = perform_search(user, params, is_semantic=True)

        assert result["count"] == 1
        # Verify native kNN scoring was configured (replaces the old script_score)
        call_args = mock_execute.call_args[0][0]
        assert "query" not in call_args
        assert call_args["knn"]["field"] == "embeddings_vector"
        assert call_args["knn"]["query_vector"] == [0.1] * 10
        assert call_args["sort"] == {"_score": {"order": "desc"}}

    @patch("search.services.execute_search")
    def test_records_recent_search(self, mock_execute, authenticated_client):
        from search.models import RecentSearch

        user, _ = authenticated_client()
        mock_execute.return_value = _make_es_response(
            hits=[],
            aggregations={"Doctype Filter": {"buckets": []}},
        )

        params = _query_dict({"term_search": "unique query 12345"})
        perform_search(user, params)

        assert RecentSearch.objects.filter(user=user, search_text="unique query 12345").exists()

    @patch("search.services.execute_search")
    def test_no_search_term_skips_multi_match(self, mock_execute, authenticated_client):
        """When only filters are used (no search term), no multi_match clause."""
        user, _ = authenticated_client()
        mock_execute.return_value = _make_es_response(
            hits=[],
            aggregations={"Doctype Filter": {"buckets": []}},
        )

        params = _query_dict({"doctype": "note"})
        perform_search(user, params)

        call_args = mock_execute.call_args[0][0]
        must_clauses = call_args["query"]["function_score"]["query"]["bool"]["must"]
        assert not any("multi_match" in c for c in must_clauses)


# ---------------------------------------------------------------------------
# Real-cluster (es8) regression guards
# ---------------------------------------------------------------------------


@pytest.mark.data_quality
def test_mget_uses_es8_kwargs():
    """mget works with es8 keyword args (no deprecated body=), returning real docs."""
    from django.conf import settings

    from lib.util import get_elasticsearch_connection

    es = get_elasticsearch_connection()
    sample = es.search(index=settings.ELASTICSEARCH_INDEX, size=2, _source=False)
    ids = [h["_id"] for h in sample["hits"]["hits"]]
    assert ids, "index has no docs to test against"

    resp = es.mget(index=settings.ELASTICSEARCH_INDEX, ids=ids)
    assert [d["_id"] for d in resp["docs"]] == ids
    assert all(d["found"] for d in resp["docs"])


def _note_uuid_and_vector(es, index, user_id=1):
    """Return (uuid, embeddings_vector) for one real note in the index."""
    resp = es.search(
        index=index, size=1, source=["uuid"],
        query={"bool": {"must": [
            {"term": {"doctype": "note"}},
            {"term": {"user_id": user_id}},
            {"exists": {"field": "embeddings_vector"}},
        ]}},
    )
    hit = resp["hits"]["hits"][0]
    doc = es.get(index=index, id=hit["_id"], source=["embeddings_vector"])
    return hit["_id"], doc["_source"]["embeddings_vector"]


def test_rrf_fuse_combines_ranks():
    """_rrf_fuse merges ranked hit lists; a doc in both lists outranks singles."""
    from search.services import _rrf_fuse

    list_a = [{"_id": "x", "_source": {"uuid": "x"}}, {"_id": "y", "_source": {"uuid": "y"}}]
    list_b = [{"_id": "y", "_source": {"uuid": "y"}}, {"_id": "z", "_source": {"uuid": "z"}}]
    fused = _rrf_fuse([list_a, list_b], rank_constant=60)
    ids = [h["_id"] for h in fused]
    assert ids[0] == "y"               # appears in both lists → highest fused score
    assert set(ids) == {"x", "y", "z"}
    assert fused[0]["_score"] == pytest.approx(1 / 61 + 1 / 62)
    assert _rrf_fuse([[], []]) == []


@patch("search.services.len_safe_get_embedding")
@patch("search.services.execute_search")
def test_semantic_search_fuses_bm25_and_knn(mock_execute, mock_embedding):
    """semantic_search runs separate BM25 + kNN queries (both user/doctype
    filtered) and fuses them with Python-side RRF."""
    from types import SimpleNamespace

    import search.services as svc

    mock_embedding.return_value = [0.1] * 10
    bm25_resp = {"hits": {"hits": [
        {"_id": "A", "_score": 5.0, "_source": {"uuid": "A"}},
        {"_id": "B", "_score": 4.0, "_source": {"uuid": "B"}},
    ]}}
    knn_resp = {"hits": {"hits": [
        {"_id": "B", "_score": 0.9, "_source": {"uuid": "B"}},
        {"_id": "C", "_score": 0.8, "_source": {"uuid": "C"}},
    ]}}
    mock_execute.side_effect = [bm25_resp, knn_resp]

    request = SimpleNamespace(user=SimpleNamespace(id=1))
    out = svc.semantic_search(request, "meaning of life", size=10)

    assert mock_execute.call_count == 2
    bm25_body = mock_execute.call_args_list[0][0][0]
    knn_body = mock_execute.call_args_list[1][0][0]

    note_filter = [{"term": {"user_id": 1}}, {"term": {"doctype": "note"}}]
    multi_match = bm25_body["query"]["bool"]["must"][0]["multi_match"]
    assert multi_match["query"] == "meaning of life"
    assert multi_match["fields"] == ["name^2", "contents"]
    assert bm25_body["query"]["bool"]["filter"] == note_filter
    assert "knn" not in bm25_body

    assert knn_body["knn"]["field"] == "chunks.vector"
    assert knn_body["knn"]["query_vector"] == [0.1] * 10
    assert knn_body["knn"]["filter"] == note_filter

    hits = out["hits"]["hits"]
    ids = [h["_id"] for h in hits]
    assert ids[0] == "B"               # in both lists → top
    assert set(ids) == {"A", "B", "C"}
    assert hits[0]["_score"] == pytest.approx(1 / 61 + 1 / 62)


@patch("search.services.len_safe_get_embedding")
@patch("search.services.execute_search")
def test_semantic_search_empty_results(mock_execute, mock_embedding):
    """When both sub-queries return nothing, semantic_search returns an empty
    result set (which drives the chatbot's abstention path)."""
    from types import SimpleNamespace

    import search.services as svc

    mock_embedding.return_value = [0.1] * 10
    mock_execute.side_effect = [{"hits": {"hits": []}}, {"hits": {"hits": []}}]

    request = SimpleNamespace(user=SimpleNamespace(id=1))
    out = svc.semantic_search(request, "no matches here", size=8)

    assert out["hits"]["hits"] == []
    assert out["hits"]["total"]["value"] == 0


@pytest.mark.data_quality
def test_semantic_search_hybrid_retrieves_its_note(monkeypatch):
    """Hybrid retrieval (nested-chunk kNN + BM25) surfaces a note when queried
    by one of its own chunk vectors + its name."""
    from types import SimpleNamespace

    from django.conf import settings

    import search.services as svc
    from lib.util import get_elasticsearch_connection

    es = get_elasticsearch_connection()
    idx = settings.ELASTICSEARCH_INDEX
    resp = es.search(index=idx, size=1, _source=["uuid", "name", "chunks"],
        query={"bool": {"filter": [
            {"term": {"doctype": "note"}},
            {"nested": {"path": "chunks", "query": {"exists": {"field": "chunks.vector"}}}},
        ]}})
    hit = resp["hits"]["hits"][0]
    uuid_ = hit["_id"]
    vec = hit["_source"]["chunks"][0]["vector"]
    name = hit["_source"].get("name") or "note"
    monkeypatch.setattr(svc, "len_safe_get_embedding", lambda *a, **k: vec)

    request = SimpleNamespace(user=SimpleNamespace(id=1))
    out = svc.semantic_search(request, name, size=10)
    hits = out["hits"]["hits"]
    assert hits, "expected note hits"
    assert any(h["_id"] == uuid_ for h in hits), "self note should be retrieved"


@pytest.mark.data_quality
def test_semantic_search_passage_is_matched_chunk_text(monkeypatch):
    """A kNN-retrieved note's generation passage contains its matched
    nested-chunk text, not a BM25 highlight or truncated contents.

    Guards the nested ``inner_hits`` ``_source`` field path: it must be
    root-relative (``chunks.text``). A relative path (``text``) makes
    Elasticsearch return an empty inner-hit ``_source``, which silently drops
    every chunk passage and degrades generation to BM25 highlights. (The passage
    also includes the matched chunk's neighbors, so this checks containment, not
    equality.)
    """
    from types import SimpleNamespace

    from django.conf import settings

    import search.services as svc
    from lib.util import get_elasticsearch_connection

    es = get_elasticsearch_connection()
    idx = settings.ELASTICSEARCH_INDEX
    resp = es.search(index=idx, size=50, _source=["uuid", "name", "chunks"],
        query={"bool": {"filter": [
            {"term": {"doctype": "note"}},
            {"term": {"user_id": 1}},
            {"nested": {"path": "chunks", "query": {"exists": {"field": "chunks.vector"}}}},
        ]}})
    # A multi-chunk note whose LAST chunk is a mid/tail slice — distinct from
    # both the contents-prefix fallback and a name-based BM25 highlight (which
    # both land on the note's head), so the assertion only holds if the matched
    # chunk text genuinely reaches the LLM passage.
    multi = [h for h in resp["hits"]["hits"] if len(h["_source"].get("chunks", [])) >= 3]
    if not multi:
        pytest.skip("no multi-chunk note available to exercise chunk-passage extraction")
    hit = multi[0]
    uuid_ = hit["_id"]
    chunk = hit["_source"]["chunks"][-1]
    name = hit["_source"].get("name") or "note"
    # Query by that chunk's own vector: it is its own nearest neighbour
    # (cosine 1.0), so inner_hits must surface exactly that chunk.
    monkeypatch.setattr(svc, "len_safe_get_embedding", lambda *a, **k: chunk["vector"])

    request = SimpleNamespace(user=SimpleNamespace(id=1))
    out = svc.semantic_search(request, name, size=10)
    note_hit = next((h for h in out["hits"]["hits"] if h["_id"] == uuid_), None)
    assert note_hit is not None, "self note should be retrieved"
    assert chunk["text"] in note_hit["_passage"]
    assert "<em>" not in note_hit["_passage"], "passage is chunk text, not a BM25 highlight"


@patch("search.services.len_safe_get_embedding")
@patch("search.services.execute_search")
def test_semantic_search_uses_nested_chunks_and_passages(mock_execute, mock_embedding):
    """kNN runs over nested chunks with inner_hits; BM25 adds a highlight; each
    returned note carries a _passage (chunk > highlight > contents fallback)."""
    from types import SimpleNamespace

    import search.services as svc

    mock_embedding.return_value = [0.1] * 10
    bm25_resp = {"hits": {"hits": [
        {"_id": "B", "_score": 4.0, "_source": {"uuid": "B", "contents": "B body"},
         "highlight": {"contents": ["...B highlight fragment..."]}},
    ]}}
    knn_resp = {"hits": {"hits": [
        {"_id": "A", "_score": 0.9, "_source": {"uuid": "A", "contents": "A body"},
         "inner_hits": {"chunks": {"hits": {"hits": [
             {"_source": {"text": "A matched chunk"}}]}}}},
    ]}}
    mock_execute.side_effect = [bm25_resp, knn_resp]

    request = SimpleNamespace(user=SimpleNamespace(id=1))
    out = svc.semantic_search(request, "q", size=10)

    knn_body = mock_execute.call_args_list[1][0][0]
    assert knn_body["knn"]["field"] == "chunks.vector"
    assert "inner_hits" in knn_body["knn"]
    bm25_body = mock_execute.call_args_list[0][0][0]
    assert "highlight" in bm25_body and "contents" in bm25_body["highlight"]["fields"]

    passages = {h["_id"]: h["_passage"] for h in out["hits"]["hits"]}
    assert passages["A"] == "A matched chunk"
    assert passages["B"] == "...B highlight fragment..."


@patch("search.services.len_safe_get_embedding")
@patch("search.services.execute_search")
def test_semantic_search_passage_falls_back_to_contents(mock_execute, mock_embedding):
    """A note with neither a chunk nor a highlight falls back to contents[:1500]."""
    from types import SimpleNamespace

    import search.services as svc

    mock_embedding.return_value = [0.1] * 10
    bm25_resp = {"hits": {"hits": [
        {"_id": "C", "_score": 4.0, "_source": {"uuid": "C", "contents": "C" * 5000}},
    ]}}
    knn_resp = {"hits": {"hits": []}}
    mock_execute.side_effect = [bm25_resp, knn_resp]

    request = SimpleNamespace(user=SimpleNamespace(id=1))
    out = svc.semantic_search(request, "q", size=10)
    assert out["hits"]["hits"][0]["_passage"] == "C" * 1500


def _knn_window_hit(uuid, chunk_texts, matched_offset):
    """A kNN parent hit carrying its ordered chunk texts plus one matched inner
    chunk at ``matched_offset`` (with the ``_nested.offset`` ES attaches)."""
    return {
        "_id": uuid,
        "_score": 0.9,
        "_source": {"uuid": uuid, "chunks": [{"text": t} for t in chunk_texts]},
        "inner_hits": {"chunks": {"hits": {"hits": [
            {"_nested": {"field": "chunks", "offset": matched_offset},
             "_source": {"text": chunk_texts[matched_offset]}}]}}},
    }


class TestKnnWindowPassage:
    def test_middle_offset_includes_both_neighbors(self):
        from search.services import _knn_window_passage
        hit = _knn_window_hit("A", ["c0", "c1", "c2", "c3"], 2)
        assert _knn_window_passage(hit, 1) == "c1\n\nc2\n\nc3"

    def test_offset_zero_clamps_low(self):
        from search.services import _knn_window_passage
        hit = _knn_window_hit("A", ["c0", "c1", "c2"], 0)
        assert _knn_window_passage(hit, 1) == "c0\n\nc1"

    def test_last_offset_clamps_high(self):
        from search.services import _knn_window_passage
        hit = _knn_window_hit("A", ["c0", "c1", "c2"], 2)
        assert _knn_window_passage(hit, 1) == "c1\n\nc2"

    def test_window_zero_returns_only_matched_chunk(self):
        from search.services import _knn_window_passage
        hit = _knn_window_hit("A", ["c0", "c1", "c2"], 1)
        assert _knn_window_passage(hit, 0) == "c1"

    def test_no_inner_hits_returns_none(self):
        from search.services import _knn_window_passage
        hit = {"_id": "A", "_source": {"uuid": "A", "chunks": [{"text": "c0"}]},
               "inner_hits": {"chunks": {"hits": {"hits": []}}}}
        assert _knn_window_passage(hit, 1) is None

    def test_missing_parent_chunks_falls_back_to_matched_text(self):
        from search.services import _knn_window_passage
        hit = {"_id": "A", "_source": {"uuid": "A"},
               "inner_hits": {"chunks": {"hits": {"hits": [
                   {"_nested": {"field": "chunks", "offset": 3},
                    "_source": {"text": "matched only"}}]}}}}
        assert _knn_window_passage(hit, 1) == "matched only"

    def test_missing_nested_offset_falls_back_to_matched_text(self):
        from search.services import _knn_window_passage
        hit = {"_id": "A",
               "_source": {"uuid": "A", "chunks": [{"text": "c0"}, {"text": "c1"}]},
               "inner_hits": {"chunks": {"hits": {"hits": [
                   {"_source": {"text": "matched"}}]}}}}
        assert _knn_window_passage(hit, 1) == "matched"


@pytest.mark.data_quality
def test_semantic_search_passage_includes_chunk_neighbors(monkeypatch):
    """A kNN-matched note's passage carries the matched chunk's positional
    neighbors (offset-1 and offset+1), not just the matched chunk itself."""
    from types import SimpleNamespace

    from django.conf import settings

    import search.services as svc
    from lib.util import get_elasticsearch_connection

    es = get_elasticsearch_connection()
    idx = settings.ELASTICSEARCH_INDEX
    resp = es.search(index=idx, size=50, _source=["uuid", "name", "chunks"],
        query={"bool": {"filter": [
            {"term": {"doctype": "note"}},
            {"term": {"user_id": 1}},
            {"nested": {"path": "chunks", "query": {"exists": {"field": "chunks.vector"}}}},
        ]}})
    multi = [h for h in resp["hits"]["hits"] if len(h["_source"].get("chunks", [])) >= 3]
    if not multi:
        pytest.skip("no note with >=3 chunks available")
    hit = multi[0]
    uuid_ = hit["_id"]
    chunks = hit["_source"]["chunks"]
    mid = len(chunks) // 2  # a middle offset, so both neighbors exist
    # Query by the middle chunk's own vector: it is its own nearest neighbour,
    # so inner_hits surfaces exactly that chunk at offset `mid`.
    monkeypatch.setattr(svc, "len_safe_get_embedding", lambda *a, **k: chunks[mid]["vector"])

    request = SimpleNamespace(user=SimpleNamespace(id=1))
    out = svc.semantic_search(request, hit["_source"].get("name") or "note", size=10)
    note_hit = next((h for h in out["hits"]["hits"] if h["_id"] == uuid_), None)
    assert note_hit is not None, "self note should be retrieved"
    passage = note_hit["_passage"]
    assert chunks[mid]["text"] in passage, "matched chunk present"
    assert chunks[mid - 1]["text"] in passage, "previous neighbour present"
    assert chunks[mid + 1]["text"] in passage, "next neighbour present"


@pytest.mark.data_quality
def test_perform_search_semantic_uses_knn(monkeypatch):
    """perform_search semantic mode returns native-kNN cosine-scored hits."""
    from types import SimpleNamespace

    from django.conf import settings
    from django.http import QueryDict

    import search.services as svc
    from lib.util import get_elasticsearch_connection

    es = get_elasticsearch_connection()
    uuid_, vec = _note_uuid_and_vector(es, settings.ELASTICSEARCH_INDEX)
    monkeypatch.setattr(svc, "len_safe_get_embedding", lambda *a, **k: vec)

    user = SimpleNamespace(id=1)
    params = QueryDict("semantic_search=anything")
    out = svc.perform_search(user, params, is_semantic=True)

    # perform_search runs hits through _filter_results, which renames
    # _score -> score and _source -> source.
    assert out["results"], "expected results"
    # Cosine kNN scores are (1 + cosine) / 2, nominally in [0, 1], but the
    # index quantizes vectors (int8_hnsw) and scores against the quantized
    # copies, so a self-match can land slightly above 1.0.
    for h in out["results"]:
        assert 0.0 <= h["score"] <= 1.0 + 1e-2, h["score"]
    assert any(h["_id"] == uuid_ for h in out["results"])
