import logging
import requests
from pathlib import Path
from unittest.mock import patch

import pytest
import responses

from django.db import IntegrityError
from django.db.models import Max

from feed.models import Feed, FeedItem, UserFeedItemState
from feed.tests.factories import FeedFactory, FeedItemFactory

pytestmark = [pytest.mark.django_db]


def test_feed_str(authenticated_client, feed):
    """Test that Feed.__str__ returns the feed name."""
    user, _ = authenticated_client()

    assert str(feed[0]) == "Hacker News"


def test_get_current_feed_id(authenticated_client, feed):
    """Test that get_current_feed_id returns the correct feed for different session states."""
    user, _ = authenticated_client()

    session = {}
    assert Feed.get_current_feed_id(user, session) == feed[2].id

    session = {"current_feed": feed[0].id}
    assert Feed.get_current_feed_id(user, session) == feed[0].id

    # Test for a non-existent current. This should
    #  return the first feed
    # Compute an id guaranteed not to exist rather than hardcoding one: the
    # lookup in get_current_feed_id is global, and the reused test DB's id
    # sequence climbs across runs, so any literal eventually collides with a
    # real feed.
    # The lookup emits a warning we'd like to keep out of the test output.
    # logging.disable() is process-global, so restore it afterwards to avoid
    # suppressing warnings in tests that run later in the same session.
    nonexistent_feed_id = (Feed.objects.aggregate(max_id=Max("id"))["max_id"] or 0) + 1
    logging.disable(logging.WARNING)
    try:
        session = {"current_feed": nonexistent_feed_id}
        assert Feed.get_current_feed_id(user, session) == feed[2].id
    finally:
        logging.disable(logging.NOTSET)


def test_get_first_feed(authenticated_client, feed):
    """Test that get_first_feed returns the first feed ordered by sort order."""
    user, _ = authenticated_client()

    assert Feed.get_first_feed(user) == {
        "id": feed[2].id
    }


@responses.activate
def test_update(authenticated_client, feed):
    """Test that update fetches, parses, and upserts feed items correctly.

    The fixture rss.xml has 4 entries; entries 3 and 4 share a link, so the
    upsert collapses them to a single row (the second occurrence wins),
    leaving 3 unique items. The factory-created seed items are wiped first
    via filter().delete() since they have unrelated links.
    """
    user, _ = authenticated_client()

    feed[0].feeditem_set.all().delete()

    with open(Path(__file__).parent / "resources/rss.xml") as f:
        xml = f.read()

    responses.add(responses.GET, feed[0].url, body=xml)

    feed[0].update()

    assert feed[0].last_response_code == 200

    items = FeedItem.objects.filter(feed=feed[0]).order_by("id")

    assert items.count() == 3
    # In-Python dedup in Feed.update() keeps the first occurrence of a
    # given (feed, link) pair; entry 3's "Bad Title" wins over entry 4.
    assert items[2].title == "Bad Title"

    # Entry 1 (the awards thread) has rich HTML content; summary is stripped to text.
    awards_item = items[0]
    assert "Best of 2020" in awards_item.summary
    assert "<a" not in awards_item.summary  # HTML tags stripped
    assert "  " not in awards_item.summary  # whitespace collapsed

    # Entry 2 has a media:thumbnail; entry 1 does not.
    assert items[1].thumbnail_url.startswith("https://b.thumbs.redditmedia.com/")
    assert awards_item.thumbnail_url == ""


@responses.activate
def test_update_preserves_existing_items_and_user_state(authenticated_client, feed):
    """Upsert preserves item identity (and per-user read state) across refreshes."""
    user, _ = authenticated_client()

    feed[0].feeditem_set.all().delete()

    with open(Path(__file__).parent / "resources/rss.xml") as f:
        xml = f.read()

    responses.add(responses.GET, feed[0].url, body=xml)
    responses.add(responses.GET, feed[0].url, body=xml)

    feed[0].update()
    first_pass_ids = list(FeedItem.objects.filter(feed=feed[0]).order_by("id").values_list("id", flat=True))

    # Mark one item as read for the user.
    item = FeedItem.objects.get(pk=first_pass_ids[0])
    UserFeedItemState.objects.create(user=user, feed_item=item)

    # Re-running update should NOT recreate the item; the read state survives.
    feed[0].update()
    second_pass_ids = list(FeedItem.objects.filter(feed=feed[0]).order_by("id").values_list("id", flat=True))

    assert first_pass_ids == second_pass_ids
    assert UserFeedItemState.objects.filter(user=user, feed_item_id=first_pass_ids[0]).exists()


@responses.activate
def test_update_decodes_double_encoded_title(authenticated_client, feed):
    """Titles from feeds that double-encode entities are fully decoded.

    The XML source carries a triple-escaped ampersand; the XML parser resolves
    one layer, leaving feedparser with "&amp;amp;". The two html.unescape passes
    in Feed.update() must collapse that to a single literal "&" (a single pass
    would leave a visible "&amp;").
    """
    user, _ = authenticated_client()

    feed[0].feeditem_set.all().delete()

    xml = (
        '<?xml version="1.0"?>'
        '<rss version="2.0"><channel><title>t</title>'
        "<item><title>Tom &amp;amp;amp; Jerry</title>"
        "<link>http://example.com/double-encoded</link></item>"
        "</channel></rss>"
    )
    responses.add(responses.GET, feed[0].url, body=xml)

    feed[0].update()

    item = FeedItem.objects.get(feed=feed[0], link="http://example.com/double-encoded")
    assert item.title == "Tom & Jerry"


def test_feeditem_unique_together(authenticated_client, feed):
    """A second FeedItem with the same (feed, link) raises IntegrityError."""
    authenticated_client()

    item = feed[0].feeditem_set.first()

    with pytest.raises(IntegrityError):
        FeedItemFactory(feed=feed[0], link=item.link)


def test_user_feed_item_state_unique(authenticated_client, feed):
    """A user can only have one state row per feed item."""
    user, _ = authenticated_client()
    item = feed[0].feeditem_set.first()

    UserFeedItemState.objects.create(user=user, feed_item=item)

    with pytest.raises(IntegrityError):
        UserFeedItemState.objects.create(user=user, feed_item=item)


@responses.activate
def test_update_retries_then_succeeds(authenticated_client, feed):
    """A 429 is retried; a subsequent 200 succeeds and items are upserted."""
    user, _ = authenticated_client()
    feed[0].feeditem_set.all().delete()

    with open(Path(__file__).parent / "resources/rss.xml") as f:
        xml = f.read()

    # First response 429, second 200.
    responses.add(responses.GET, feed[0].url, status=429, headers={"Retry-After": "1"})
    responses.add(responses.GET, feed[0].url, body=xml, status=200)

    with patch("feed.models.time.sleep") as mock_sleep:
        feed[0].update()

    mock_sleep.assert_called_once_with(1.0)  # honored Retry-After
    assert feed[0].last_response_code == 200
    assert FeedItem.objects.filter(feed=feed[0]).count() == 3


@responses.activate
def test_update_exhausts_retries_records_429(authenticated_client, feed):
    """When 429s never clear, last_response_code is 429 and nothing is upserted."""
    user, _ = authenticated_client()
    feed[0].feeditem_set.all().delete()

    # MAX_RETRIES + 1 attempts, all 429.
    for _ in range(4):
        responses.add(responses.GET, feed[0].url, status=429, headers={"Retry-After": "1"})

    with patch("feed.models.time.sleep"):
        with pytest.raises(requests.HTTPError):
            feed[0].update()

    assert feed[0].last_response_code == 429
    assert FeedItem.objects.filter(feed=feed[0]).count() == 0


@responses.activate
def test_update_records_403_and_raises(authenticated_client, feed):
    """A non-retryable non-200 (403) records the code and raises HTTPError.

    Graceful handling of upstream failures now lives in feed.services, not on
    the model; the model surfaces the error.
    """
    user, _ = authenticated_client()
    responses.add(responses.GET, feed[0].url, status=403)

    with pytest.raises(requests.HTTPError):
        feed[0].update()

    assert feed[0].last_response_code == 403


@responses.activate
def test_update_sends_feed_user_agent(authenticated_client, feed):
    """Feed.update sends the Reddit-compliant FEED_USER_AGENT, not USER_AGENT."""
    user, _ = authenticated_client()
    feed[0].feeditem_set.all().delete()

    with open(Path(__file__).parent / "resources/rss.xml") as f:
        xml = f.read()
    responses.add(responses.GET, feed[0].url, body=xml, status=200)

    feed[0].update()

    sent_ua = responses.calls[0].request.headers["user-agent"]
    assert sent_ua == "python:com.bordercore.feedreader:v1.0 (by jerrell@bordercore.com)"


class _StubResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code != 200:
            raise requests.HTTPError(response=self)


class _StubRedditClient:
    def __init__(self, payload, status=200):
        self._resp = _StubResponse(payload, status)

    def get(self, path):
        return self._resp


def test_update_dispatches_reddit_url_to_oauth_client(authenticated_client, feed):
    """A reddit.com feed uses the injected RedditClient, not the .rss path."""
    authenticated_client()
    feed[0].url = "https://www.reddit.com/r/Python/.rss"
    feed[0].save()
    feed[0].feeditem_set.all().delete()

    payload = {"data": {"children": [
        {"data": {"title": "Post", "permalink": "/r/Python/comments/1/p/", "created_utc": 1700000000}},
    ]}}

    feed[0].update(reddit_client=_StubRedditClient(payload))

    assert feed[0].last_response_code == 200
    assert FeedItem.objects.filter(feed=feed[0]).count() == 1
    assert FeedItem.objects.get(feed=feed[0]).link == "https://www.reddit.com/r/Python/comments/1/p/"


@responses.activate
def test_update_reddit_without_client_falls_back_to_rss(authenticated_client, feed):
    """With no client, a reddit feed falls back to the .rss path, even without creds."""
    authenticated_client()
    feed[0].url = "https://www.reddit.com/r/Python/.rss"
    feed[0].save()
    feed[0].feeditem_set.all().delete()

    with open(Path(__file__).parent / "resources/rss.xml") as f:
        xml = f.read()

    responses.add(responses.GET, feed[0].url, body=xml)
    feed[0].update(reddit_client=None)

    feed[0].refresh_from_db()
    assert feed[0].last_check is not None
    assert feed[0].last_response_code == 200


def test_update_reddit_records_failing_status(authenticated_client, feed):
    """A failed reddit fetch records the HTTP error status on last_response_code."""
    authenticated_client()
    feed[0].url = "https://www.reddit.com/r/Python/.rss"
    feed[0].save()

    client = _StubRedditClient({}, status=503)
    with pytest.raises(requests.HTTPError):
        feed[0].update(reddit_client=client)

    feed[0].refresh_from_db()
    assert feed[0].last_response_code == 503


def test_update_reddit_without_client_uses_rss():
    """With no OAuth client, a reddit feed falls through to the .rss path."""
    feed = FeedFactory(url="https://www.reddit.com/r/python/.rss")
    with patch.object(Feed, "_update_rss", return_value=0) as rss, \
         patch.object(Feed, "_update_reddit") as oauth:
        feed.update(reddit_client=None)
    rss.assert_called_once_with()
    oauth.assert_not_called()


def test_update_reddit_with_client_uses_oauth():
    """With an OAuth client, a reddit feed uses the OAuth path."""
    feed = FeedFactory(url="https://www.reddit.com/r/python/.rss")
    client = object()
    with patch.object(Feed, "_update_reddit", return_value=0) as oauth, \
         patch.object(Feed, "_update_rss") as rss:
        feed.update(reddit_client=client)
    oauth.assert_called_once_with(client)
    rss.assert_not_called()
