"""Tests for the feed refresh orchestration service."""
from unittest.mock import patch

import pytest
import requests

from feed.services import refresh_feeds

pytestmark = [pytest.mark.django_db]


class RecordingThrottle:
    """Stand-in throttle that records the urls it was asked to pace."""

    def __init__(self):
        self.waited = []

    def wait(self, url):
        self.waited.append(url)


def test_refresh_feeds_updates_every_feed(authenticated_client, feed):
    """Each feed is fetched once and the throttle is consulted per feed."""
    authenticated_client()
    throttle = RecordingThrottle()

    with patch("feed.models.Feed.update", return_value=0) as mock_update:
        refresh_feeds(throttle=throttle)

    assert mock_update.call_count == len(feed)
    assert len(throttle.waited) == len(feed)


def test_refresh_feeds_single_uuid(authenticated_client, feed):
    """Passing a uuid refreshes only that feed."""
    authenticated_client()
    throttle = RecordingThrottle()

    with patch("feed.models.Feed.update", return_value=0) as mock_update:
        refresh_feeds(feed_uuid=str(feed[0].uuid), throttle=throttle)

    assert mock_update.call_count == 1
    assert throttle.waited == [feed[0].url]


def test_refresh_feeds_swallows_fetch_errors(authenticated_client, feed):
    """A per-feed fetch failure is logged and does not abort the run."""
    authenticated_client()
    throttle = RecordingThrottle()

    with patch("feed.models.Feed.update", side_effect=requests.HTTPError("429")) as mock_update:
        # Should not raise even though every update() fails.
        refresh_feeds(throttle=throttle)

    assert mock_update.call_count == len(feed)


def test_refresh_feeds_builds_and_shares_one_reddit_client(authenticated_client, feed, settings):
    """One RedditClient is constructed per run and passed to every feed."""
    authenticated_client()
    settings.REDDIT_CLIENT_ID = "id"
    settings.REDDIT_CLIENT_SECRET = "secret"
    throttle = RecordingThrottle()
    captured = []

    def fake_update(self, *, reddit_client=None):
        captured.append(reddit_client)
        return 0

    with patch("feed.models.Feed.update", autospec=True, side_effect=fake_update):
        refresh_feeds(throttle=throttle)

    assert len(captured) == len(feed)
    assert captured[0] is not None
    assert all(c is captured[0] for c in captured)


def test_refresh_feeds_passes_none_client_when_creds_missing(authenticated_client, feed, settings):
    """With no creds, refresh passes None so reddit feeds fail cleanly per-feed."""
    authenticated_client()
    settings.REDDIT_CLIENT_ID = ""
    settings.REDDIT_CLIENT_SECRET = ""
    captured = []

    def fake_update(self, *, reddit_client=None):
        captured.append(reddit_client)
        return 0

    with patch("feed.models.Feed.update", autospec=True, side_effect=fake_update):
        refresh_feeds(throttle=RecordingThrottle())

    assert captured and all(c is None for c in captured)


def test_refresh_feeds_swallows_reddit_auth_error(authenticated_client, feed, settings):
    """A RedditAuthError (a RequestException subclass) does not abort the run."""
    from feed.reddit import RedditAuthError

    authenticated_client()
    settings.REDDIT_CLIENT_ID = "id"
    settings.REDDIT_CLIENT_SECRET = "secret"

    with patch("feed.models.Feed.update", side_effect=RedditAuthError("boom")) as mock_update:
        refresh_feeds(throttle=RecordingThrottle())

    assert mock_update.call_count == len(feed)
