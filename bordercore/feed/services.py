"""Service functions for refreshing RSS/Atom feeds."""
from __future__ import annotations

import logging

import requests

from lib.constants import FEED_DOMAIN_MIN_INTERVAL_SECONDS

from .models import Feed
from .throttle import DomainThrottle

log: logging.Logger = logging.getLogger(f"bordercore.{__name__}")


def refresh_feeds(feed_uuid: str | None = None, *, throttle: DomainThrottle | None = None) -> None:
    """Refresh one feed (by uuid) or all feeds, pacing same-domain requests.

    Each feed is fetched in-process via :meth:`Feed.update`. A per-domain
    throttle spaces requests to the same host (e.g. reddit.com) so we are not
    rate limited; feeds on distinct hosts proceed at full speed. A per-feed
    fetch failure is logged and does not abort the run.

    Args:
        feed_uuid: If given, refresh only the feed with this uuid; otherwise
            refresh every feed.
        throttle: Pacing helper; a default per-domain throttle is created when
            not supplied (injectable for tests).
    """
    if throttle is None:
        throttle = DomainThrottle(FEED_DOMAIN_MIN_INTERVAL_SECONDS)

    feeds = Feed.objects.filter(uuid=feed_uuid) if feed_uuid else Feed.objects.all()

    for feed in feeds:
        throttle.wait(feed.url)
        try:
            feed.update()
        except requests.RequestException as e:
            log.warning("feed_uuid=%s refresh failed: %s", feed.uuid, e)
