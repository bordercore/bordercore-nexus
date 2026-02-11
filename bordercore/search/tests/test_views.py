import uuid
from unittest.mock import MagicMock, Mock, patch

import pytest

import django
from django import urls
from django.test import RequestFactory

from search.views import (SearchTagDetailView, get_doctypes_from_request,
                          get_doctype, get_name, is_cached, sort_results)

pytestmark = [pytest.mark.django_db]

django.setup()


@patch("search.services.get_elasticsearch_connection")
def test_notes_list(mock_get_es, auto_login_user):

    _, client = auto_login_user()

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
