"""Service functions for refreshing RSS/Atom feeds."""
from __future__ import annotations

import logging
from datetime import datetime, timezone as dt_timezone
from typing import TYPE_CHECKING

import requests
from django.conf import settings

from lib.constants import (
    FEED_DOMAIN_MIN_INTERVAL_SECONDS,
    FEED_REDDIT_MAX_PER_RUN,
    FEED_REDDIT_MIN_INTERVAL_SECONDS,
)

from .models import Feed, _is_reddit_url
from .throttle import DomainThrottle

if TYPE_CHECKING:
    from feed.reddit import RedditClient

log: logging.Logger = logging.getLogger(f"bordercore.{__name__}")

# Sort sentinel: never-checked feeds (last_check is None) are the stalest and
# must sort ahead of every checked feed.
_AWARE_MIN: datetime = datetime.min.replace(tzinfo=dt_timezone.utc)


def refresh_feeds(
    feed_uuid: str | None = None,
    *,
    throttle: DomainThrottle | None = None,
    reddit_client: "RedditClient | None" = None,
) -> None:
    """Refresh one feed (by uuid) or the scheduled set, pacing same-domain requests.

    A full run refreshes every non-reddit feed plus only the
    ``FEED_REDDIT_MAX_PER_RUN`` stalest reddit feeds, keeping the per-IP reddit
    request rate under Reddit's unauthenticated ceiling. Reddit feeds use the
    OAuth client when one is configured, otherwise the ``.rss`` path. A per-feed
    failure is logged and does not abort the run.

    Args:
        feed_uuid: If given, refresh only the feed with this uuid (no rotation);
            otherwise the scheduled set.
        throttle: Per-domain pacing helper (injectable for tests).
        reddit_client: Shared Reddit OAuth client (injectable for tests); built
            from settings when omitted, or None when creds are unset.
    """
    if throttle is None:
        throttle = DomainThrottle(
            FEED_DOMAIN_MIN_INTERVAL_SECONDS,
            domain_overrides={"reddit.com": FEED_REDDIT_MIN_INTERVAL_SECONDS},
        )
    if reddit_client is None:
        reddit_client = _build_reddit_client()

    if feed_uuid:
        feeds = list(Feed.objects.filter(uuid=feed_uuid))
    else:
        feeds = _select_feeds_for_run()

    for feed in feeds:
        throttle.wait(feed.url)
        try:
            feed.update(reddit_client=reddit_client)
        except requests.RequestException as e:
            log.warning("feed_uuid=%s refresh failed: %s", feed.uuid, e)


def _select_feeds_for_run() -> list[Feed]:
    """Every non-reddit feed plus the N stalest reddit feeds (rotation).

    Reddit feeds are sorted by ``last_check`` ascending with never-checked
    feeds first, so the longest-waiting feeds are refreshed first.
    """
    all_feeds = list(Feed.objects.all())
    reddit = [f for f in all_feeds if _is_reddit_url(f.url)]
    other = [f for f in all_feeds if not _is_reddit_url(f.url)]
    reddit.sort(key=lambda f: f.last_check or _AWARE_MIN)
    return other + reddit[:FEED_REDDIT_MAX_PER_RUN]


def _build_reddit_client() -> "RedditClient | None":
    """Build a RedditClient from settings, or None when creds are unset.

    When None, reddit feeds use the unauthenticated ``.rss`` path instead of
    OAuth (see ``Feed.update``).
    """
    from feed.reddit import RedditClient

    client_id = settings.REDDIT_CLIENT_ID
    client_secret = settings.REDDIT_CLIENT_SECRET
    if not (client_id and client_secret):
        log.info("Reddit OAuth credentials not configured; reddit feeds use the .rss path")
        return None
    return RedditClient(client_id, client_secret)
