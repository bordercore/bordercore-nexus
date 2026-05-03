from pathlib import Path
from unittest.mock import patch
from urllib.parse import quote

import pytest
import requests
import responses
from feed.models import Feed, UserFeedItemState

from django import urls

from accounts.tests.factories import UserFactory
from feed.tests.factories import FeedFactory

pytestmark = [pytest.mark.django_db]


def test_feed_list(authenticated_client, feed):
    """Test that the feed list page returns 200 for an authenticated user."""
    _, client = authenticated_client()

    url = urls.reverse("feed:list")
    resp = client.get(url)

    assert resp.status_code == 200


def test_feed_delete(authenticated_client, feed):
    """Test that deleting a feed removes it from the database."""
    _, client = authenticated_client()

    feed[0].feeditem_set.all().delete()

    url = urls.reverse("feed-detail", kwargs={"uuid": feed[0].uuid})
    resp = client.delete(url)

    assert resp.status_code == 204

    assert Feed.objects.filter(uuid=feed[0].uuid).count() == 0


def test_sort_feed(authenticated_client, feed):
    """Test that sorting a feed returns 200."""
    _, client = authenticated_client()

    url = urls.reverse("feed:sort")
    resp = client.post(url, {"feed_id": feed[0].id, "position": "2"})

    assert resp.status_code == 200


def test_sort_feed_invalid_position(authenticated_client, feed):
    """Test that a non-numeric position returns 400."""
    _, client = authenticated_client()

    url = urls.reverse("feed:sort")
    resp = client.post(url, {"feed_id": feed[0].id, "position": "abc"})

    assert resp.status_code == 400


def test_sort_feed_other_user(authenticated_client, feed):
    """Test that a user cannot sort another user's feed."""
    other_user = UserFactory(username="other_user")
    _, client = authenticated_client(user=other_user)

    url = urls.reverse("feed:sort")
    resp = client.post(url, {"feed_id": feed[0].id, "position": "1"})

    assert resp.status_code == 404


@responses.activate
def test_check_url_valid_feed(authenticated_client):
    """Test that check_url returns entry count for a valid feed URL."""
    _, client = authenticated_client()

    with open(Path(__file__).parent / "resources/rss.xml") as f:
        xml = f.read()

    feed_url = "https://example.com/rss.xml"
    responses.add(responses.GET, feed_url, body=xml)

    encoded_url = quote(feed_url, safe="")
    url = urls.reverse("feed:check_url", kwargs={"url": encoded_url})
    resp = client.get(url)

    assert resp.status_code == 200
    assert resp.json()["entry_count"] == 4


def test_check_url_network_error(authenticated_client):
    """Test that check_url returns 400 on a network error."""
    _, client = authenticated_client()

    feed_url = "https://example.com/rss.xml"
    encoded_url = quote(feed_url, safe="")
    url = urls.reverse("feed:check_url", kwargs={"url": encoded_url})

    with patch("feed.views.requests.get", side_effect=requests.ConnectionError("Connection refused")):
        resp = client.get(url)

    assert resp.status_code == 400
    assert "detail" in resp.json()


def test_check_url_private_ip(authenticated_client):
    """Test that check_url blocks requests to private IPs."""
    _, client = authenticated_client()

    feed_url = "https://169.254.169.254/latest/meta-data/"
    encoded_url = quote(feed_url, safe="")
    url = urls.reverse("feed:check_url", kwargs={"url": encoded_url})

    with patch("feed.views.socket.gethostbyname", return_value="169.254.169.254"):
        resp = client.get(url)

    assert resp.status_code == 400
    assert "private" in resp.json()["detail"].lower()


@responses.activate
def test_update_feed_list(authenticated_client, feed):
    """Test that update_feed_list refreshes feed items and returns count."""
    _, client = authenticated_client()

    with open(Path(__file__).parent / "resources/rss.xml") as f:
        xml = f.read()

    responses.add(responses.GET, feed[0].url, body=xml)

    url = f"/api/feeds/update_feed_list/{feed[0].uuid}/"
    resp = client.post(url)

    assert resp.status_code == 200
    # rss.xml has 4 entries but two share a link, so the upsert dedupes
    # them down to 3 unique items.
    assert resp.json()["updated_count"] == 3


def test_mark_item_read(authenticated_client, feed):
    """Marking an item as read creates a UserFeedItemState with read_at set."""
    user, client = authenticated_client()
    item = feed[0].feeditem_set.first()

    url = urls.reverse("feed:mark_item_read", kwargs={"pk": item.pk})
    resp = client.post(url)

    assert resp.status_code == 200
    assert resp.json()["read_at"] is not None
    state = UserFeedItemState.objects.get(user=user, feed_item=item)
    assert state.read_at is not None


def test_mark_item_read_idempotent(authenticated_client, feed):
    """Calling mark_item_read twice keeps the original read_at."""
    user, client = authenticated_client()
    item = feed[0].feeditem_set.first()

    url = urls.reverse("feed:mark_item_read", kwargs={"pk": item.pk})
    first = client.post(url).json()["read_at"]
    second = client.post(url).json()["read_at"]

    assert first == second
    assert UserFeedItemState.objects.filter(user=user, feed_item=item).count() == 1


def test_mark_item_read_other_users_item_404(authenticated_client):
    """A user cannot mark another user's item as read."""
    other_user = UserFactory(username="other_user")
    other_feed = FeedFactory(user=other_user)
    other_item = other_feed.feeditem_set.first()

    _, client = authenticated_client()

    url = urls.reverse("feed:mark_item_read", kwargs={"pk": other_item.pk})
    resp = client.post(url)

    assert resp.status_code == 404


def test_mark_feed_read(authenticated_client, feed):
    """mark_all_read marks every item in the feed as read for the user."""
    user, client = authenticated_client()
    items = list(feed[0].feeditem_set.all())

    url = urls.reverse("feed:mark_feed_read", kwargs={"feed_uuid": feed[0].uuid})
    resp = client.post(url)

    assert resp.status_code == 200
    assert resp.json()["marked"] == len(items)
    for item in items:
        assert UserFeedItemState.objects.filter(user=user, feed_item=item, read_at__isnull=False).exists()


def test_mark_feed_read_idempotent(authenticated_client, feed):
    """Calling mark_all_read twice marks 0 the second time."""
    _, client = authenticated_client()

    url = urls.reverse("feed:mark_feed_read", kwargs={"feed_uuid": feed[0].uuid})
    first = client.post(url).json()["marked"]
    second = client.post(url).json()["marked"]

    assert first > 0
    assert second == 0


def test_mark_feed_read_other_users_feed_404(authenticated_client):
    """A user cannot mark all items in another user's feed."""
    other_user = UserFactory(username="other_user")
    other_feed = FeedFactory(user=other_user)

    _, client = authenticated_client()

    url = urls.reverse("feed:mark_feed_read", kwargs={"feed_uuid": other_feed.uuid})
    resp = client.post(url)

    assert resp.status_code == 404
