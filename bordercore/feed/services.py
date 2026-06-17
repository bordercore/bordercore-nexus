"""Service functions for refreshing RSS/Atom feeds."""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import requests
from django.conf import settings

from lib.constants import FEED_DOMAIN_MIN_INTERVAL_SECONDS

from .models import Feed
from .throttle import DomainThrottle

if TYPE_CHECKING:
    from feed.reddit import RedditClient

log: logging.Logger = logging.getLogger(f"bordercore.{__name__}")


def refresh_feeds(
    feed_uuid: str | None = None,
    *,
    throttle: DomainThrottle | None = None,
    reddit_client: "RedditClient | None" = None,
) -> None:
    """Refresh one feed (by uuid) or all feeds, pacing same-domain requests.

    Reddit feeds are fetched through a single shared OAuth client (one token per
    run); other feeds use the throttled HTTP path. A per-feed failure is logged
    and does not abort the run.

    Args:
        feed_uuid: If given, refresh only the feed with this uuid; otherwise all.
        throttle: Per-domain pacing helper (injectable for tests).
        reddit_client: Shared Reddit OAuth client (injectable for tests); built
            from settings when omitted.
    """
    if throttle is None:
        throttle = DomainThrottle(FEED_DOMAIN_MIN_INTERVAL_SECONDS)
    if reddit_client is None:
        reddit_client = _build_reddit_client()

    feeds = Feed.objects.filter(uuid=feed_uuid) if feed_uuid else Feed.objects.all()

    for feed in feeds:
        throttle.wait(feed.url)
        try:
            feed.update(reddit_client=reddit_client)
        except requests.RequestException as e:
            log.warning("feed_uuid=%s refresh failed: %s", feed.uuid, e)


def _build_reddit_client() -> "RedditClient | None":
    """Build a RedditClient from settings, or None (logged) when creds are unset."""
    from feed.reddit import RedditClient

    client_id = settings.REDDIT_CLIENT_ID
    client_secret = settings.REDDIT_CLIENT_SECRET
    if not (client_id and client_secret):
        log.warning("Reddit OAuth credentials not configured; reddit feeds will be skipped")
        return None
    return RedditClient(client_id, client_secret)
