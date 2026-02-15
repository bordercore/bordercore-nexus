import pytest

from bookmark.models import Bookmark
from bookmark.tests.factories import BookmarkFactory


@pytest.fixture
def monkeypatch_bookmark(monkeypatch):
    """
    Prevent the bookmark objects from interacting with external services
    AWS and Elasticsearch
    """

    def mock(*args, **kwargs):
        pass

    monkeypatch.setattr(Bookmark, "generate_cover_image", mock)
    monkeypatch.setattr(Bookmark, "snarf_favicon", mock)
    monkeypatch.setattr(Bookmark, "delete", mock)


@pytest.fixture()
def bookmark(tag, monkeypatch_bookmark):

    bookmark_1 = BookmarkFactory(daily={"viewed": "false"})
    bookmark_2 = BookmarkFactory()
    bookmark_3 = BookmarkFactory(is_pinned=True)
    bookmark_4 = BookmarkFactory()
    bookmark_5 = BookmarkFactory()

    bookmark_3.tags.add(tag[0])
    bookmark_2.tags.add(tag[0])
    bookmark_1.tags.add(tag[0])
    bookmark_1.tags.add(tag[1])

    yield [bookmark_1, bookmark_2, bookmark_3, bookmark_4, bookmark_5]
