import pytest

from bookmark.models import Bookmark
from bookmark.tests.factories import BookmarkFactory

pytestmark = pytest.mark.django_db


def test_get_tags(bookmark):

    tags = bookmark[0].get_tags()
    assert tags == "django, video"

    tags = bookmark[1].get_tags()
    assert tags == "django"


def test_bookmark_delete_tag(bookmark):

    bookmark[0].delete_tag(bookmark[0].tags.first())
    updated_bookmark = Bookmark.objects.get(uuid=bookmark[0].uuid)
    assert updated_bookmark.tags.count() == 1


def test_bookmark_thumbnail_url_static(bookmark):

    assert Bookmark.thumbnail_url_static(bookmark[0].uuid, bookmark[0].url) == f"https://blobs.bordercore.com/bookmarks/{bookmark[0].uuid}-small.png"


def test_bookmark_thumbnail_url(bookmark):

    assert bookmark[0].thumbnail_url == f"https://blobs.bordercore.com/bookmarks/{bookmark[0].uuid}-small.png"


def test_get_favicon_img_tag(monkeypatch_bookmark):

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


def test_related_nodes(monkeypatch_bookmark, node):

    bookmark = BookmarkFactory(user=node.user)
    collection = node.add_collection()
    collection.add_object(bookmark)

    related_nodes = bookmark.related_nodes()

    assert len(related_nodes) == 1
    assert str(node.uuid) in [x["uuid"] for x in related_nodes]
