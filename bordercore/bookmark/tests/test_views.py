import datetime
import json

import pytest
from faker import Factory as FakerFactory

from django import urls

from bookmark.models import Bookmark
from bookmark.tests.factories import BookmarkFactory
from tag.tests.factories import TagFactory

pytestmark = [pytest.mark.django_db]

faker = FakerFactory.create()


def test_bookmark_click(auto_login_user, bookmark):

    _, client = auto_login_user()

    url = urls.reverse("bookmark:click", kwargs={"bookmark_uuid": bookmark[0].uuid})
    resp = client.get(url)

    assert resp.status_code == 302


def test_bookmark_update(monkeypatch_bookmark, auto_login_user, bookmark):

    _, client = auto_login_user()

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


def test_bookmark_create(monkeypatch_bookmark, auto_login_user, bookmark):

    _, client = auto_login_user()

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


def test_bookmark_delete(monkeypatch_bookmark, auto_login_user, bookmark):

    _, client = auto_login_user()

    url = urls.reverse("bookmark:delete", kwargs={"uuid": bookmark[0].uuid})
    resp = client.post(url)

    assert resp.status_code == 302


def test_bookmark_list(auto_login_user, bookmark):

    _, client = auto_login_user()

    url = urls.reverse("bookmark:get_bookmarks_by_page", kwargs={"page_number": 1})
    resp = client.get(url)

    assert resp.status_code == 200

    url = urls.reverse("bookmark:get_bookmarks_by_page", kwargs={"page_number": 2})
    resp = client.get(url)

    assert resp.status_code == 200


def test_bookmark_snarf_link(monkeypatch_bookmark, auto_login_user, bookmark):

    _, client = auto_login_user()

    url = urls.reverse("bookmark:snarf")
    resp = client.get(f"{url}?url=http%3A%2F%2Fwww.bordercore.com%2F&name=Sample%2BTitlte")

    assert resp.status_code == 302


def test_bookmark_get_tags_used_by_bookmarks(auto_login_user, bookmark):

    _, client = auto_login_user()

    url = urls.reverse("bookmark:get_tags_used_by_bookmarks")
    resp = client.get(url)

    assert resp.status_code == 200


def test_bookmark_overview(auto_login_user, bookmark):

    _, client = auto_login_user()

    url = urls.reverse("bookmark:overview")
    resp = client.get(url)

    assert resp.status_code == 200


def test_bookmark_get_bookmarks_by_tag(auto_login_user, bookmark):

    _, client = auto_login_user()

    url = urls.reverse("bookmark:get_bookmarks_by_tag", kwargs={"tag_filter": "django"})
    resp = client.get(url)

    assert resp.status_code == 200


def test_bookmark_sort_pinned_tags(auto_login_user, sort_order_user_tag, tag):

    _, client = auto_login_user()

    url = urls.reverse("bookmark:sort_pinned_tags")
    resp = client.post(url, {
        "tag_id": tag[1].id,
        "new_position": 1
    })

    assert resp.status_code == 200


def test_bookmark_sort_bookmarks(auto_login_user, tag, bookmark):

    _, client = auto_login_user()

    url = urls.reverse("bookmark:sort")
    resp = client.post(url, {
        "tag": tag[0].name,
        "bookmark_uuid": bookmark[0].uuid,
        "position": 3
    })

    assert resp.status_code == 200


def test_bookmark_add_note(auto_login_user, tag, bookmark):

    _, client = auto_login_user()

    url = urls.reverse("bookmark:add_note")
    resp = client.post(url, {
        "tag": tag[0].name,
        "bookmark_uuid": bookmark[0].uuid,
        "note": "Sample Note"
    })

    assert resp.status_code == 200


def test_bookmark_get_new_bookmarks_count(auto_login_user, bookmark):

    _, client = auto_login_user()

    timestamp = datetime.datetime.now()

    url = urls.reverse("bookmark:get_new_bookmarks_count", kwargs={"timestamp": f"{timestamp:%s}"})
    resp = client.get(url)

    assert resp.status_code == 200
    assert json.loads(resp.content)["count"] == 5


def test_bookmark_get_title_from_url(auto_login_user, bookmark):

    _, client = auto_login_user()

    url = urls.reverse("bookmark:get_title_from_url")
    resp = client.get(f"{url}?url=http%3A%2F%2Fwww.bordercore.com")

    assert resp.status_code == 200


def test_add_tag(auto_login_user, monkeypatch_bookmark):

    user, client = auto_login_user()

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
    assert resp.status_code == 200


def test_remove_tag(auto_login_user, monkeypatch_bookmark):

    user, client = auto_login_user()

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
    assert resp.status_code == 200

    # Trying to remove the tag again should produce an error
    url = urls.reverse("bookmark:remove_tag")
    resp = client.post(url, {
        "bookmark_uuid": bookmark.uuid,
        "tag_name": tag.name
    })
    assert json.loads(resp.content)["status"] == "ERROR"
    updated_bookmark = Bookmark.objects.get(uuid=bookmark.uuid)
    assert updated_bookmark.tags.count() == 0
    assert resp.status_code == 400
