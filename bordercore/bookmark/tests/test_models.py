import pytest

from bookmark.models import Bookmark
from bookmark.tests.factories import BookmarkFactory

pytestmark = [pytest.mark.django_db]


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
