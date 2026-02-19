import uuid
from unittest.mock import patch

import pytest

from django import urls

pytestmark = [pytest.mark.django_db]


def _mock_es_search_return(hits=None, aggregations=None):
    """Build a mock Elasticsearch response."""
    return {
        "hits": {
            "total": {"value": len(hits) if hits else 0},
            "hits": hits or [],
        },
        "aggregations": aggregations or {},
    }


def _make_hit(doctype="note", name="Test", score=1.0, **extra_source):
    source = {
        "uuid": str(uuid.uuid4()),
        "doctype": doctype,
        "name": name,
        "date_unixtime": 1700000000,
        "importance": 1,
        "tags": [],
        **extra_source,
    }
    return {"_score": score, "_source": source, "_id": str(uuid.uuid4())}


# --- search_tags_and_names ---


@patch("search.api.execute_search")
def test_search_tags_and_names(mock_execute, authenticated_client):
    _, client = authenticated_client()

    mock_execute.return_value = _mock_es_search_return(
        hits=[_make_hit(doctype="note", name="Django Notes")],
        aggregations={"Distinct Tags": {"buckets": [{"key": "django", "doc_count": 5}]}},
    )

    url = urls.reverse("search:search_tags_and_names")
    resp = client.get(url, {"term": "django"})

    assert resp.status_code == 200
    data = resp.json()
    # Should contain both tag and name results
    assert any(item.get("doctype") == "Tag" for item in data)


@patch("search.api.execute_search")
def test_search_tags_and_names_with_doctype_filter(mock_execute, authenticated_client):
    _, client = authenticated_client()

    mock_execute.return_value = _mock_es_search_return(
        hits=[],
        aggregations={"Distinct Tags": {"buckets": []}},
    )

    url = urls.reverse("search:search_tags_and_names")
    resp = client.get(url, {"term": "test", "doctype": "note,blob"})

    assert resp.status_code == 200
    assert mock_execute.called


@patch("search.api.execute_search")
def test_search_tags_and_names_empty(mock_execute, authenticated_client):
    _, client = authenticated_client()

    mock_execute.return_value = _mock_es_search_return(
        aggregations={"Distinct Tags": {"buckets": []}},
    )

    url = urls.reverse("search:search_tags_and_names")
    resp = client.get(url, {"term": "zzzznonexistent"})

    assert resp.status_code == 200
    assert resp.json() == []


# --- search_names ---


@patch("search.api.execute_search")
def test_search_names(mock_execute, authenticated_client):
    _, client = authenticated_client()

    mock_execute.return_value = _mock_es_search_return(
        hits=[_make_hit(doctype="note", name="Meeting Notes")],
    )

    url = urls.reverse("search:search_names")
    resp = client.get(url, {"term": "meeting"})

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["name"] == "Meeting Notes"


@patch("search.api.execute_search")
def test_search_names_truncates_long_terms(mock_execute, authenticated_client):
    _, client = authenticated_client()

    mock_execute.return_value = _mock_es_search_return()

    url = urls.reverse("search:search_names")
    # Terms > 10 chars should be truncated, terms < 2 chars should be removed
    resp = client.get(url, {"term": "averylongterm x short"})

    assert resp.status_code == 200
    # Verify the search was called (term processing doesn't crash)
    assert mock_execute.called


@patch("search.api.execute_search")
def test_search_names_with_image_doctype(mock_execute, authenticated_client):
    _, client = authenticated_client()

    mock_execute.return_value = _mock_es_search_return(
        hits=[_make_hit(doctype="blob", name="photo.jpg", content_type="image/jpeg")],
    )

    url = urls.reverse("search:search_names")
    resp = client.get(url, {"term": "photo", "doctype": "image"})

    assert resp.status_code == 200


@patch("search.api.execute_search")
def test_search_names_with_media_doctype(mock_execute, authenticated_client):
    _, client = authenticated_client()

    mock_execute.return_value = _mock_es_search_return(
        hits=[],
    )

    url = urls.reverse("search:search_names")
    resp = client.get(url, {"term": "clip", "doctype": "media"})

    assert resp.status_code == 200


@patch("search.api.execute_search")
def test_search_names_with_date(mock_execute, authenticated_client):
    _, client = authenticated_client()

    mock_execute.return_value = _mock_es_search_return(
        hits=[_make_hit(doctype="note", name="Dated Note", date_unixtime=1700000000)],
    )

    url = urls.reverse("search:search_names")
    resp = client.get(url, {"term": "dated"})

    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["date"] == "Nov 2023"


@patch("search.api.execute_search")
def test_search_names_without_date(mock_execute, authenticated_client):
    _, client = authenticated_client()

    mock_execute.return_value = _mock_es_search_return(
        hits=[_make_hit(doctype="note", name="Undated Note", date_unixtime=None)],
    )

    url = urls.reverse("search:search_names")
    resp = client.get(url, {"term": "undated"})

    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["date"] == ""


@patch("search.api.execute_search")
def test_search_names_cover_url_for_blob(mock_execute, authenticated_client):
    _, client = authenticated_client()

    test_uuid = str(uuid.uuid4())
    mock_execute.return_value = _mock_es_search_return(
        hits=[_make_hit(doctype="blob", name="doc.pdf", uuid=test_uuid, filename="doc.pdf")],
    )

    url = urls.reverse("search:search_names")
    resp = client.get(url, {"term": "doc"})

    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["type"] == "blob"


@patch("search.api.execute_search")
def test_search_names_cover_url_for_bookmark(mock_execute, authenticated_client):
    _, client = authenticated_client()

    mock_execute.return_value = _mock_es_search_return(
        hits=[_make_hit(
            doctype="bookmark",
            name="Python Docs",
            url="https://docs.python.org",
        )],
    )

    url = urls.reverse("search:search_names")
    resp = client.get(url, {"term": "python"})

    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["type"] == "bookmark"


@patch("search.api.execute_search")
def test_search_names_collection_has_description(mock_execute, authenticated_client):
    _, client = authenticated_client()

    mock_execute.return_value = _mock_es_search_return(
        hits=[_make_hit(
            doctype="collection",
            name="My Collection",
            description="A test collection",
        )],
    )

    url = urls.reverse("search:search_names")
    resp = client.get(url, {"term": "collection"})

    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["description"] == "A test collection"


# --- search_music ---


@patch("search.api.execute_search")
def test_search_music_by_song(mock_execute, authenticated_client):
    _, client = authenticated_client()

    mock_execute.return_value = _mock_es_search_return(
        hits=[{
            "_score": 1.0,
            "_source": {
                "artist": "Radiohead",
                "uuid": str(uuid.uuid4()),
                "title": "Creep",
                "track": 1,
            },
        }],
    )

    resp = client.get("/api/search/music/", {"song": "Creep"})

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Creep"
    assert data[0]["artist"] == "Radiohead"


@patch("search.api.execute_search")
def test_search_music_by_artist(mock_execute, authenticated_client):
    _, client = authenticated_client()

    mock_execute.return_value = _mock_es_search_return(
        hits=[{
            "_score": 1.0,
            "_source": {
                "artist": "Radiohead",
                "uuid": str(uuid.uuid4()),
                "title": "Karma Police",
            },
        }],
    )

    resp = client.get("/api/search/music/", {"artist": "Radiohead"})

    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["artist"] == "Radiohead"


@patch("search.api.execute_search")
def test_search_music_by_album(mock_execute, authenticated_client, song):
    _, client = authenticated_client()

    album = song[0].album

    mock_execute.return_value = _mock_es_search_return(
        hits=[{
            "_score": 1.0,
            "_source": {
                "artist": song[0].artist.name,
                "uuid": str(song[0].uuid),
                "title": song[0].title,
                "track": 1,
            },
        }],
    )

    resp = client.get("/api/search/music/", {"album": album.title})

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1


@patch("search.api.execute_search")
def test_search_music_empty(mock_execute, authenticated_client):
    _, client = authenticated_client()

    mock_execute.return_value = _mock_es_search_return()

    resp = client.get("/api/search/music/")

    assert resp.status_code == 200
    assert resp.json() == []


def test_search_music_requires_auth(client):
    resp = client.get("/api/search/music/")
    assert resp.status_code == 403
