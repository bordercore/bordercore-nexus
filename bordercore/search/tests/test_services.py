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


@pytest.mark.data_quality
def test_semantic_search_returns_knn_scores_in_unit_range(monkeypatch):
    """semantic_search uses native kNN: scores land in [0, 1] and a note's own
    vector self-matches as the top hit at ~1.0."""
    from types import SimpleNamespace

    from django.conf import settings

    import search.services as svc
    from lib.util import get_elasticsearch_connection

    es = get_elasticsearch_connection()
    uuid_, vec = _note_uuid_and_vector(es, settings.ELASTICSEARCH_INDEX)
    monkeypatch.setattr(svc, "len_safe_get_embedding", lambda *a, **k: vec)

    request = SimpleNamespace(user=SimpleNamespace(id=1))
    out = svc.semantic_search(request, "anything", size=5)
    hits = out["hits"]["hits"]
    assert hits, "expected note hits"
    for h in hits:
        assert 0.0 <= h["_score"] <= 1.0, h["_score"]
    assert hits[0]["_id"] == uuid_
    assert hits[0]["_score"] > 0.99


@pytest.mark.data_quality
def test_perform_search_semantic_uses_knn(monkeypatch):
    """perform_search semantic mode returns native-kNN hits scored in [0, 1]."""
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
    for h in out["results"]:
        assert 0.0 <= h["score"] <= 1.0, h["score"]
    assert any(h["_id"] == uuid_ for h in out["results"])
