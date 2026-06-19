"""Tests for the feed refresh orchestration service."""
from datetime import timedelta
from unittest.mock import patch

import pytest
import requests

from django.utils import timezone

from feed.services import refresh_feeds
from feed.tests.factories import FeedFactory
from feed.throttle import DomainThrottle

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
    """With no creds, refresh passes None so reddit feeds use the .rss path."""
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


def test_rotation_refreshes_only_stalest_reddit_feeds(authenticated_client, feed, monkeypatch):
    """Non-reddit feeds all run; only the N stalest reddit feeds run."""
    authenticated_client()
    monkeypatch.setattr("feed.services.FEED_REDDIT_MAX_PER_RUN", 2)

    now = timezone.now()
    never = FeedFactory(url="https://www.reddit.com/r/never/.rss", last_check=None)
    old = FeedFactory(url="https://www.reddit.com/r/old/.rss", last_check=now - timedelta(days=2))
    recent = FeedFactory(url="https://www.reddit.com/r/recent/.rss", last_check=now)

    updated = []

    def record(self, *, reddit_client=None):
        updated.append(self.url)
        return 0

    with patch("feed.models.Feed.update", autospec=True, side_effect=record):
        refresh_feeds(throttle=RecordingThrottle())

    # never + old are the 2 stalest reddit feeds; recent is skipped this run.
    assert never.url in updated
    assert old.url in updated
    assert recent.url not in updated
    # All three non-reddit fixture feeds still run every time.
    for f in feed:
        assert f.url in updated


def test_single_uuid_bypasses_rotation(authenticated_client, monkeypatch):
    """A uuid refresh always runs that one feed, ignoring the rotation cap."""
    authenticated_client()
    monkeypatch.setattr("feed.services.FEED_REDDIT_MAX_PER_RUN", 0)
    target = FeedFactory(url="https://www.reddit.com/r/solo/.rss", last_check=None)

    updated = []

    def record(self, *, reddit_client=None):
        updated.append(self.url)
        return 0

    with patch("feed.models.Feed.update", autospec=True, side_effect=record):
        refresh_feeds(feed_uuid=str(target.uuid), throttle=RecordingThrottle())

    assert updated == [target.url]


def test_default_throttle_uses_reddit_override(authenticated_client, feed):
    """When no throttle is injected, the reddit interval override is wired in."""
    from lib.constants import (
        FEED_DOMAIN_MIN_INTERVAL_SECONDS,
        FEED_REDDIT_MIN_INTERVAL_SECONDS,
    )

    authenticated_client()
    with patch("feed.services.DomainThrottle") as MockThrottle, \
         patch("feed.models.Feed.update", return_value=0):
        refresh_feeds()

    MockThrottle.assert_called_once_with(
        FEED_DOMAIN_MIN_INTERVAL_SECONDS,
        domain_overrides={"reddit.com": FEED_REDDIT_MIN_INTERVAL_SECONDS},
    )


def test_reddit_feeds_share_one_bucket_through_refresh(authenticated_client):
    """Two reddit subdomains share one 12s pacing bucket via the real throttle."""
    authenticated_client()
    FeedFactory(url="https://www.reddit.com/r/a/.rss")
    FeedFactory(url="https://old.reddit.com/r/b/.rss")

    slept = []
    times = iter([100.0, 100.0])  # one monotonic() read per wait(): both at t=100
    throttle = DomainThrottle(
        3.0,
        sleep=slept.append,
        monotonic=lambda: next(times),
        domain_overrides={"reddit.com": 12.0},
    )

    with patch("feed.models.Feed.update", return_value=0):
        refresh_feeds(throttle=throttle)

    # Second reddit hit lands in the same "reddit.com" bucket with 0 elapsed,
    # so it sleeps the full 12s override interval.
    assert slept == [12.0]
