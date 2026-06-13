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
