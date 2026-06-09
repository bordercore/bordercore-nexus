from unittest.mock import patch

import pytest

from bookmark.models import Bookmark
from bookmark.tests.factories import BookmarkFactory

pytestmark = [pytest.mark.django_db]


class _FakeResponse:
    """Minimal stand-in for a requests.Response in YouTube cover tests."""

    def __init__(self, data=None, content=b""):
        self._data = data
        self.content = content

    def json(self):
        return self._data


def test_generate_youtube_cover_image_persists_duration(monkeypatch_bookmark, authenticated_client):
    """The YouTube cover path stores the video duration via a targeted save.

    generate_youtube_cover_image() calls save(update_fields=["data"]) to persist
    the duration without re-running the full save() body during a single create.
    """
    user, _ = authenticated_client()
    bookmark = BookmarkFactory(user=user, url="https://www.youtube.com/watch?v=abc123")

    video_payload = {
        "items": [{
            "contentDetails": {"duration": "PT5M23S"},
            "snippet": {"thumbnails": {"medium": {"url": "https://img.example/thumb.jpg"}}},
        }]
    }
    responses = [_FakeResponse(data=video_payload), _FakeResponse(content=b"imgbytes")]

    with patch("bookmark.models.requests.get", side_effect=responses), \
         patch("bookmark.services.upload_youtube_thumbnail") as mock_upload:
        bookmark.generate_youtube_cover_image()

    bookmark.refresh_from_db()
    assert bookmark.data["video_duration"] == 323
    mock_upload.assert_called_once()


def test_get_tags(bookmark):
    """Bookmark returns comma-separated tag names."""
    tags = bookmark[0].get_tags()
    assert tags == "django, video"

    tags = bookmark[1].get_tags()
    assert tags == "django"


def test_elasticsearch_document_date_unixtime_is_utc_correct(bookmark):
    """date_unixtime is a portable, UTC-correct epoch string.

    The previous strftime("%s") was non-portable and interpreted the aware
    datetime in the server's local timezone, producing an offset epoch.
    """
    from datetime import datetime
    from datetime import timezone as dt_timezone

    bookmark[0].created = datetime(2021, 1, 1, 0, 0, 0, tzinfo=dt_timezone.utc)
    doc = bookmark[0].elasticsearch_document

    assert doc["_source"]["date_unixtime"] == "1609459200"


def test_bookmark_delete_tag(bookmark):
    """Deleting a tag removes it from the bookmark."""
    bookmark[0].delete_tag(bookmark[0].tags.first())
    updated_bookmark = Bookmark.objects.get(uuid=bookmark[0].uuid)
    assert updated_bookmark.tags.count() == 1


def test_bookmark_thumbnail_url_static(bookmark):
    """Static thumbnail URL returns the small PNG variant."""
    assert Bookmark.thumbnail_url_static(bookmark[0].uuid, bookmark[0].url) == f"https://blobs.bordercore.com/bookmarks/{bookmark[0].uuid}-small.png"


def test_bookmark_thumbnail_url(bookmark):
    """Thumbnail URL property returns the correct path."""
    assert bookmark[0].thumbnail_url == f"https://blobs.bordercore.com/bookmarks/{bookmark[0].uuid}-small.png"


def test_get_favicon_img_tag(monkeypatch_bookmark):
    """Favicon img tag is generated from the bookmark URL domain."""
    bookmark = BookmarkFactory(url="https://www.bordercore.com")

    url = bookmark.get_favicon_img_tag()
    assert url == "<img src=\"https://www.bordercore.com/favicons/bordercore.com.ico\" width=\"32\" height=\"32\" />"

    bookmark.url = "http://www.bordercore.com"
    url = bookmark.get_favicon_img_tag()
    assert url == "<img src=\"https://www.bordercore.com/favicons/bordercore.com.ico\" width=\"32\" height=\"32\" />"

    bookmark.url = "http://www.bordercore.com/path"
    url = bookmark.get_favicon_img_tag()
    assert url == "<img src=\"https://www.bordercore.com/favicons/bordercore.com.ico\" width=\"32\" height=\"32\" />"

    bookmark.url = "bordercore.com/path"
    url = bookmark.get_favicon_img_tag()
    assert url == ""


def test_get_favicon_img_tag_escapes_domain(monkeypatch_bookmark):
    """A double-quote in the URL authority is escaped, preventing attribute breakout."""
    bookmark = BookmarkFactory(url='https://evil"onerror=alert(1).com')

    tag = bookmark.get_favicon_img_tag()

    # The raw quote must not survive into the rendered <img> attribute.
    assert '"onerror=' not in tag
    assert "&quot;onerror=" in tag


def test_related_nodes(monkeypatch_bookmark, node):
    """Related nodes returns nodes containing collections with this bookmark."""
    bookmark = BookmarkFactory(user=node.user)
    collection = node.add_collection()
    collection.add_object(bookmark)

    related_nodes = bookmark.related_nodes()

    assert len(related_nodes) == 1
    assert str(node.uuid) in [x["uuid"] for x in related_nodes]
