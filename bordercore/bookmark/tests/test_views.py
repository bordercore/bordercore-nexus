import datetime
import json
from unittest.mock import patch
from urllib.parse import quote

import pytest
from faker import Factory as FakerFactory

from django import urls

from bookmark.models import Bookmark
from bookmark.tests.factories import BookmarkFactory
from tag.tests.factories import TagFactory

pytestmark = [pytest.mark.django_db]

faker = FakerFactory.create()


def test_bookmark_click(authenticated_client, bookmark):
    """Clicking a bookmark redirects to its URL."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:click", kwargs={"bookmark_uuid": bookmark[0].uuid})
    resp = client.get(url)

    assert resp.status_code == 302


def test_bookmark_update(monkeypatch_bookmark, authenticated_client, bookmark):
    """Bookmark update form renders and saves changes."""
    _, client = authenticated_client()

    # The empty form
    url = urls.reverse("bookmark:update", kwargs={"uuid": bookmark[0].uuid})
    resp = client.get(url)

    assert resp.status_code == 200

    # The submitted form
    url = urls.reverse("bookmark:update", kwargs={"uuid": bookmark[0].uuid})
    resp = client.post(url, {
        "url": "https://www.bordercore.com/bookmark/",
        "name": "Sample Title Changed",
        "tags": "linux",
        "importance": "1"
    })

    updated_bookmark = Bookmark.objects.get(uuid=bookmark[0].uuid)
    assert updated_bookmark.name == "Sample Title Changed"
    assert resp.status_code == 302


def test_bookmark_update_requires_login(client, monkeypatch_bookmark, bookmark):
    """Unauthenticated user is redirected from the update view."""
    url = urls.reverse("bookmark:update", kwargs={"uuid": bookmark[0].uuid})
    resp = client.get(url)

    assert resp.status_code == 302
    assert "/accounts/login/" in resp.url


def test_bookmark_create(monkeypatch_bookmark, authenticated_client, bookmark):
    """Bookmark create form renders and creates a new bookmark."""
    _, client = authenticated_client()

    # The empty form
    url = urls.reverse("bookmark:create")
    resp = client.get(url)

    assert resp.status_code == 200

    # The submitted form
    url = urls.reverse("bookmark:create")

    resp = client.post(url, {
        "url": "https://www.bordercore.com/foo",
        "name": "Sample Title",
        "tags": "django",
        "importance": "1"
    })

    assert resp.status_code == 302


def test_bookmark_delete(monkeypatch_bookmark, authenticated_client, bookmark):
    """Deleting a bookmark redirects to the overview."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:delete", kwargs={"uuid": bookmark[0].uuid})
    resp = client.post(url)

    assert resp.status_code == 302


def test_bookmark_list(authenticated_client, bookmark):
    """Paginated bookmark list returns 200."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:get_bookmarks_by_page", kwargs={"page_number": 1})
    resp = client.get(url)

    assert resp.status_code == 200

    url = urls.reverse("bookmark:get_bookmarks_by_page", kwargs={"page_number": 2})
    resp = client.get(url)

    assert resp.status_code == 200


def test_bookmark_snarf_link(monkeypatch_bookmark, authenticated_client, bookmark):
    """Snarf link creates a bookmark and redirects."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:snarf")
    resp = client.get(f"{url}?url=http%3A%2F%2Fwww.bordercore.com%2F&name=Sample%2BTitlte")

    assert resp.status_code == 302


def test_bookmark_snarf_link_duplicate_url(monkeypatch_bookmark, authenticated_client, bookmark):
    """Snarf link with existing URL redirects to edit page with warning."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:snarf")
    encoded_url = quote(bookmark[0].url, safe="")
    resp = client.get(f"{url}?url={encoded_url}&name=Duplicate")

    assert resp.status_code == 302
    assert str(bookmark[0].uuid) in resp.url


def test_bookmark_get_tags_used_by_bookmarks(authenticated_client, bookmark):
    """Get tags used by bookmarks returns 200."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:get_tags_used_by_bookmarks")
    resp = client.get(url)

    assert resp.status_code == 200


def test_bookmark_overview(authenticated_client, bookmark):
    """Overview page renders with context data."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:overview")
    resp = client.get(url)

    assert resp.status_code == 200
    assert "pinned_tags" in resp.context
    assert "stats" in resp.context
    assert "untagged_count" in resp.context


def test_bookmark_get_bookmarks_by_tag(authenticated_client, bookmark):
    """Bookmarks filtered by tag returns 200."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:get_bookmarks_by_tag", kwargs={"tag_filter": "django"})
    resp = client.get(url)

    assert resp.status_code == 200


def test_bookmark_sort_pinned_tags(authenticated_client, sort_order_user_tag, tag):
    """Sorting pinned tags updates position."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:sort_pinned_tags")
    resp = client.post(url, {
        "tag_id": tag[1].id,
        "new_position": 1
    })

    assert resp.status_code == 200


def test_bookmark_sort_pinned_tags_invalid_position(authenticated_client, sort_order_user_tag, tag):
    """Non-numeric position value returns 400."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:sort_pinned_tags")
    resp = client.post(url, {
        "tag_id": tag[1].id,
        "new_position": "abc"
    })

    assert resp.status_code == 400


def test_bookmark_sort_bookmarks(authenticated_client, tag, bookmark):
    """Sorting bookmarks within a tag updates position."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:sort")
    resp = client.post(url, {
        "tag": tag[0].name,
        "bookmark_uuid": bookmark[0].uuid,
        "position": 3
    })

    assert resp.status_code == 200


def test_bookmark_sort_bookmarks_invalid_position(authenticated_client, tag, bookmark):
    """Non-numeric position value returns 400."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:sort")
    resp = client.post(url, {
        "tag": tag[0].name,
        "bookmark_uuid": bookmark[0].uuid,
        "position": "abc"
    })

    assert resp.status_code == 400


def test_bookmark_add_note(authenticated_client, tag, bookmark):
    """Adding a note to a bookmark-tag association returns 200."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:add_note")
    resp = client.post(url, {
        "tag": tag[0].name,
        "bookmark_uuid": bookmark[0].uuid,
        "note": "Sample Note"
    })

    assert resp.status_code == 200


def test_bookmark_get_new_bookmarks_count(authenticated_client, bookmark):
    """New bookmarks count returns correct count."""
    _, client = authenticated_client()

    timestamp = datetime.datetime.now()

    url = urls.reverse("bookmark:get_new_bookmarks_count", kwargs={"timestamp": f"{timestamp:%s}"})
    resp = client.get(url)

    assert resp.status_code == 200
    assert json.loads(resp.content)["count"] == 5


def test_bookmark_get_title_from_url(authenticated_client, bookmark):
    """Get title from URL returns 200."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:get_title_from_url")
    resp = client.get(f"{url}?url=http%3A%2F%2Fwww.bordercore.com")

    assert resp.status_code == 200


def test_get_title_from_url_private_ip(authenticated_client):
    """SSRF protection blocks requests to private IPs."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:get_title_from_url")

    with patch("bookmark.views.socket.gethostbyname", return_value="127.0.0.1"):
        resp = client.get(f"{url}?url=http%3A%2F%2Flocalhost%2Ftest")

    assert resp.status_code == 400
    assert "private" in json.loads(resp.content)["detail"].lower()


def test_get_title_from_url_missing_url(authenticated_client):
    """Missing URL parameter returns 400."""
    _, client = authenticated_client()

    url = urls.reverse("bookmark:get_title_from_url")
    resp = client.get(url)

    assert resp.status_code == 400


def test_add_tag(authenticated_client, monkeypatch_bookmark):
    """Adding a tag to a bookmark associates them."""
    user, client = authenticated_client()

    bookmark = BookmarkFactory(user=user)
    tag = TagFactory(user=user)

    url = urls.reverse("bookmark:add_tag")
    resp = client.post(url, {
        "bookmark_uuid": bookmark.uuid,
        "tag_id": tag.id
    })

    updated_bookmark = Bookmark.objects.get(uuid=bookmark.uuid)
    assert updated_bookmark.tags.count() == 1
    assert updated_bookmark.tags.first() == tag
    assert resp.status_code == 201


def test_add_tag_duplicate(authenticated_client, monkeypatch_bookmark):
    """Adding a tag that already exists on a bookmark returns 400."""
    user, client = authenticated_client()

    bookmark = BookmarkFactory(user=user)
    tag = TagFactory(user=user)
    bookmark.tags.add(tag)

    url = urls.reverse("bookmark:add_tag")
    resp = client.post(url, {
        "bookmark_uuid": bookmark.uuid,
        "tag_id": tag.id
    })

    assert resp.status_code == 400
    assert "detail" in json.loads(resp.content)


def test_remove_tag(authenticated_client, monkeypatch_bookmark):
    """Removing a tag disassociates it from the bookmark."""
    user, client = authenticated_client()

    bookmark = BookmarkFactory(user=user)
    tag = TagFactory(user=user)
    bookmark.tags.add(tag)

    url = urls.reverse("bookmark:remove_tag")
    resp = client.post(url, {
        "bookmark_uuid": bookmark.uuid,
        "tag_name": tag.name
    })

    updated_bookmark = Bookmark.objects.get(uuid=bookmark.uuid)
    assert updated_bookmark.tags.count() == 0
    assert resp.status_code == 204

    # Trying to remove the tag again should produce an error
    url = urls.reverse("bookmark:remove_tag")
    resp = client.post(url, {
        "bookmark_uuid": bookmark.uuid,
        "tag_name": tag.name
    })
    assert "detail" in json.loads(resp.content)
    updated_bookmark = Bookmark.objects.get(uuid=bookmark.uuid)
    assert updated_bookmark.tags.count() == 0
    assert resp.status_code == 400
