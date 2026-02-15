import pytest

from bookmark.services import get_recent_bookmarks

pytestmark = [pytest.mark.django_db]


def test_get_recent_bookmarks(authenticated_client, bookmark):

    user, _ = authenticated_client()

    results = get_recent_bookmarks(user)

    assert len(results) == 5
    assert results[0]["uuid"] == str(bookmark[4].uuid)
    assert results[0]["name"] == bookmark[4].name
