import json
import uuid
from unittest.mock import MagicMock, Mock, patch

import pytest

from django import urls
from django.test import RequestFactory

from search.views import (SearchTagDetailView, get_doctypes_from_request,
                          get_doctype, get_name, is_cached, sort_results)

pytestmark = [pytest.mark.django_db]


@patch("search.services.get_elasticsearch_connection")
def test_notes_list(mock_get_es, authenticated_client):

    _, client = authenticated_client()

    mock_es = MagicMock()
    mock_es.search.return_value = {
        "hits": {
            "total": {"value": 2},
            "hits": [
                {
                    "_score": 1.0,
                    "_source": {
                        "uuid": str(uuid.uuid4()),
                        "size": 1234,
                        "doctype": "note",
                        "last_modified": "2025-08-01T17:04:23.788834-04:00"
                    },
                    "_id": str(uuid.uuid4()),
                },
                {
                    "_score": 0.8,
                    "_source": {
                        "uuid": str(uuid.uuid4()),
                        "size": 5678,
                        "doctype": "note",
                        "last_modified": "2025-08-01T17:04:23.788834-04:00"
                    },
                    "_id": str(uuid.uuid4()),
                }
            ]
        },
        "aggregations": {"Doctype Filter": {"buckets": []}}
    }
    mock_get_es.return_value = mock_es

    url = urls.reverse("search:notes")
    resp = client.get(url)

    assert resp.status_code == 200
    context = resp.context
    assert context["count"] == 2
    assert isinstance(context["paginator"], str)


def test_get_doc_types_from_request():

    request_mock = Mock()

    request_mock.GET = {}
    assert get_doctypes_from_request(request_mock) == []

    request_mock.GET = {"doctype": ""}
    assert get_doctypes_from_request(request_mock) == []

    request_mock.GET = {"doctype": "music"}
    assert get_doctypes_from_request(request_mock) == ["album", "song"]

    request_mock.GET = {"doctype": "book"}
    assert get_doctypes_from_request(request_mock) == ["book"]

    request_mock.GET = {"doctype": "blob,book,document"}
    assert get_doctypes_from_request(request_mock) == ["blob", "book", "document"]


def test_sort_results():

    matches = [
        {
            "doctype": "Bookmark",
            "value": "http://python.org"
        },
        {
            "doctype": "Tag",
            "value": "python"
        },
        {
            "doctype": "Note",
            "value": "Running Emacs Inside Docker"
        },
    ]

    response = sort_results(matches)

    assert response[0]["splitter"] is True
    assert response[1]["value"] == "python"
    assert response[1]["doctype"] == "Tag"
    assert response[2]["splitter"] is True
    assert response[3]["doctype"] == "Note"
    assert response[3]["value"] == "Running Emacs Inside Docker"
    assert response[4]["splitter"] is True
    assert response[5]["doctype"] == "Bookmark"
    assert response[5]["value"] == "http://python.org"
    assert len(response) == 6


def test_get_name():

    assert get_name("Song", {"artist": "U2", "title": "Running to Stand Still"}) == "Running to Stand Still - U2"
    assert get_name("Album", {"artist": "U2", "title": "The Joshua Tree"}) == "The Joshua Tree"
    assert get_name("Artist", {"artist": "U2"}) == "U2"
    assert get_name("Book", {"name": "War and Peace"}) == "War And Peace"
    assert get_name("Book", {"name": "war and peace"}) == "War And Peace"


def test_get_doctype():

    assert get_doctype({"_source": {"doctype": "song"}}) == "Song"
    assert get_doctype({"_source": {"doctype": "song"}, "highlight": {"album": ""}}) == "Album"
    assert get_doctype({"_source": {"doctype": "song"}, "highlight": {"artist": ""}}) == "Artist"
    assert get_doctype({"_source": {"doctype": "song"}, "highlight": {"artist": "", "album": ""}}) == "Artist"


def test_is_cached():

    cache_checker = is_cached()

    assert cache_checker("Artist", "U2") is False
    assert cache_checker("Artist", "U2") is True
    assert cache_checker("Album", "The Joshau Tree") is False
    assert cache_checker("Book", "War and Peace") is False


def test_get_doc_counts():

    request = RequestFactory().get("/")
    view = SearchTagDetailView()
    view.setup(request)

    aggregations = {
        "buckets": [
            {
                "key": "document",
                "doc_count": 3
            },
            {
                "key": "blob",
                "doc_count": 2
            }
        ]
    }

    result = view.get_doc_counts([], aggregations)
    assert len(result) == 2
    assert result[0] == ("document", 3)
    assert result[1] == ("blob", 2)


# ---------------------------------------------------------------------------
# SearchListView — delegates to perform_search
# ---------------------------------------------------------------------------


def _make_hit(doctype="note", name="Test", score=1.0, **extra_source):
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


def _mock_perform_search_return(hits=None, agg_buckets=None):
    """Build a return value matching perform_search's dict shape."""
    hits = hits or []
    # Simulate _filter_results renaming _source → source
    results = []
    for h in hits:
        r = {**h}
        r["source"] = r.pop("_source", r.get("source", {}))
        r["score"] = r.pop("_score", r.get("score", 0))
        r["tags_json"] = json.dumps(r["source"].get("tags", []))
        results.append(r)
    return {
        "results": results,
        "aggregations": [
            {"doctype": b["key"], "count": b["doc_count"]}
            for b in (agg_buckets or [])
        ],
        "paginator": {
            "page_number": 1,
            "num_pages": 1,
            "total_results": len(results),
            "range": [1],
            "has_previous": False,
            "has_next": False,
            "previous_page_number": 0,
            "next_page_number": 2,
        },
        "count": len(results),
    }


@patch("search.views.perform_search")
def test_search_list_view_delegates_to_perform_search(mock_perform, authenticated_client):
    """SearchListView.get_queryset delegates to perform_search."""
    _, client = authenticated_client()

    mock_perform.return_value = _mock_perform_search_return(
        hits=[_make_hit(doctype="note", name="Found It")],
        agg_buckets=[{"key": "note", "doc_count": 1}],
    )

    url = urls.reverse("search:search")
    resp = client.get(url, {"term_search": "Found"})

    assert resp.status_code == 200
    mock_perform.assert_called_once()
    context = resp.context
    assert context["count"] == 1
    assert len(context["results"]) == 1


@patch("search.views.perform_search")
def test_search_list_view_no_params_returns_empty(mock_perform, authenticated_client):
    """Without search params, the view returns empty (no ES call)."""
    _, client = authenticated_client()

    url = urls.reverse("search:search")
    resp = client.get(url)

    assert resp.status_code == 200
    mock_perform.assert_not_called()


@patch("search.views.perform_search")
def test_search_list_view_stores_sort_in_session(mock_perform, authenticated_client):
    _, client = authenticated_client()

    mock_perform.return_value = _mock_perform_search_return()

    url = urls.reverse("search:search")
    client.get(url, {"term_search": "test", "sort": "_score"})

    assert client.session["search_sort_by"] == "_score"


@patch("search.views.perform_search")
def test_search_list_view_context_has_paginator_json(mock_perform, authenticated_client):
    _, client = authenticated_client()

    mock_perform.return_value = _mock_perform_search_return(
        hits=[_make_hit()],
    )

    url = urls.reverse("search:search")
    resp = client.get(url, {"term_search": "test"})

    context = resp.context
    # paginator should be a JSON string
    assert isinstance(context["paginator"], str)
    parsed = json.loads(context["paginator"])
    assert "page_number" in parsed


@patch("search.views.perform_search")
def test_search_list_view_context_doctype_filter(mock_perform, authenticated_client):
    _, client = authenticated_client()

    mock_perform.return_value = _mock_perform_search_return()

    url = urls.reverse("search:search")
    resp = client.get(url, {"term_search": "test", "doctype": "note"})

    context = resp.context
    assert "note" in context["doctype_filter"]


@patch("search.views.perform_search")
def test_search_list_view_context_active_tags(mock_perform, authenticated_client):
    _, client = authenticated_client()

    mock_perform.return_value = _mock_perform_search_return()

    url = urls.reverse("search:search")
    resp = client.get(url, {"term_search": "test", "tags": ["python", "django"]})

    context = resp.context
    assert context["active_tags"] == ["python", "django"]


# ---------------------------------------------------------------------------
# SemanticSearchListView — delegates to perform_search(is_semantic=True)
# ---------------------------------------------------------------------------


@patch("search.views.perform_search")
def test_semantic_search_view_delegates(mock_perform, authenticated_client):
    _, client = authenticated_client()

    mock_perform.return_value = _mock_perform_search_return(
        hits=[_make_hit(doctype="note", name="Semantic Hit")],
    )

    url = urls.reverse("search:semantic")
    resp = client.get(url, {"semantic_search": "concept"})

    assert resp.status_code == 200
    _, kwargs = mock_perform.call_args
    assert kwargs["is_semantic"] is True
    context = resp.context
    assert context["count"] == 1


@patch("search.views.perform_search")
def test_semantic_search_view_no_param_returns_empty(mock_perform, authenticated_client):
    _, client = authenticated_client()

    url = urls.reverse("search:semantic")
    resp = client.get(url)

    assert resp.status_code == 200
    mock_perform.assert_not_called()
