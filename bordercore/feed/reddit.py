"""Reddit application-only OAuth client and listing parsing.

Reddit aggressively rate-limits unauthenticated ``.rss`` requests from
datacenter IPs (HTTP 429). Fetching through application-only OAuth against
``oauth.reddit.com`` raises that ceiling to ~100 requests/minute. The token
endpoint lives on ``www.reddit.com``; authenticated API calls go to
``oauth.reddit.com`` and return JSON (not RSS), so Reddit feeds are mapped
from JSON listings rather than parsed with feedparser.
"""
from __future__ import annotations

import html
import re
import time
from collections.abc import Callable
from datetime import datetime, timezone as dt_timezone
from typing import TYPE_CHECKING
from urllib.parse import urlparse

import requests
from django.utils import timezone

from lib.constants import (
    FEED_FETCH_MAX_RETRIES,
    FEED_USER_AGENT,
    REDDIT_LISTING_LIMIT,
    REDDIT_OAUTH_API_BASE,
    REDDIT_OAUTH_TOKEN_URL,
)

# Imported at module level (not method level) because this module is itself
# imported lazily by feed.models, so feed.models is fully initialized by the
# time this runs — no circular-import risk in this direction.
from feed.models import FeedItem, RETRYABLE_STATUS, _retry_delay

if TYPE_CHECKING:
    from feed.models import Feed


class RedditAuthError(requests.RequestException):
    """Raised when Reddit OAuth cannot be established.

    Subclasses ``requests.RequestException`` so the per-feed ``except`` in
    ``feed.services.refresh_feeds`` treats an auth failure like any other fetch
    failure: log it and continue with the next feed.
    """


class RedditClient:
    """Fetches an application-only OAuth token and makes authenticated GETs.

    One token is fetched lazily and reused for the client's lifetime (one
    client per refresh run). ``sleep`` is injectable so retry pacing is
    testable without real time.
    """

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        *,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._sleep = sleep
        self._token: str | None = None

    def _ensure_token(self) -> str:
        """Return the cached token, fetching one on first use."""
        if self._token is not None:
            return self._token
        response = requests.post(
            REDDIT_OAUTH_TOKEN_URL,
            data={"grant_type": "client_credentials"},
            auth=(self._client_id, self._client_secret),
            headers={"user-agent": FEED_USER_AGENT},
            timeout=10,
        )
        if response.status_code != 200:
            raise RedditAuthError(f"Reddit token fetch failed: HTTP {response.status_code}")
        self._token = response.json()["access_token"]
        return self._token

    def get(self, path: str) -> requests.Response:
        """GET ``oauth.reddit.com<path>`` with bearer auth.

        Re-authenticates once on a 401 (expired token) and retries 429/503 with
        the shared backoff. Returns the final response without raising for
        status so the caller can record the status code.
        """
        url = f"{REDDIT_OAUTH_API_BASE}{path}"
        reauthed = False
        response: requests.Response | None = None
        for attempt in range(FEED_FETCH_MAX_RETRIES + 1):
            token = self._ensure_token()
            headers = {"user-agent": FEED_USER_AGENT, "Authorization": f"bearer {token}"}
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 401 and not reauthed:
                self._token = None  # force a fresh token, then retry once
                reauthed = True
                continue
            if response.status_code in RETRYABLE_STATUS and attempt < FEED_FETCH_MAX_RETRIES:
                self._sleep(_retry_delay(response, attempt))
                continue
            break
        assert response is not None  # loop runs at least once
        return response


_SUBREDDIT_RE = re.compile(r"^/r/(?P<sub>[^/]+)/")


def _listing_path(url: str) -> str:
    """Map a stored ``/r/<sub>/.rss`` URL to the OAuth ``/new`` listing path."""
    match = _SUBREDDIT_RE.match(urlparse(url).path)
    if not match:
        raise ValueError(f"not a subreddit feed url: {url}")
    return f"/r/{match.group('sub')}/new?limit={REDDIT_LISTING_LIMIT}"


def fetch_reddit_items(feed: Feed, client: RedditClient) -> tuple[list[FeedItem], int]:
    """Fetch a subreddit's ``/new`` listing and map it to unsaved FeedItems.

    Returns the items and the HTTP status. Raises ``requests.HTTPError`` if the
    listing response is not 200 so the caller records the failure and skips.
    """
    response = client.get(_listing_path(feed.url))
    status_code = response.status_code
    if status_code != 200:
        response.raise_for_status()
    return _parse_reddit_listing(feed, response.json()), status_code


def _parse_reddit_listing(feed: Feed, payload: dict) -> list[FeedItem]:
    """Build deduped, unsaved FeedItems from a Reddit listing payload."""
    items: list[FeedItem] = []
    seen_links: set[str] = set()
    children = payload.get("data", {}).get("children", [])
    for child in children:
        data = child.get("data", {})
        permalink = data.get("permalink", "")
        if not permalink:
            continue
        link = f"https://www.reddit.com{permalink}"
        if link in seen_links:
            continue
        seen_links.add(link)
        items.append(FeedItem(
            feed=feed,
            title=html.unescape(data.get("title", "") or "No Title"),
            link=link,
            pub_date=_reddit_pub_date(data),
            summary=_reddit_summary(data),
            thumbnail_url=_reddit_thumbnail(data),
        ))
    return items


def _reddit_pub_date(data: dict) -> datetime:
    """Convert a post's ``created_utc`` (unix seconds) to a tz-aware datetime."""
    created = data.get("created_utc")
    if created is None:
        return timezone.now()
    return datetime.fromtimestamp(float(created), tz=dt_timezone.utc)


def _reddit_summary(data: dict) -> str:
    """Return the self-post body as collapsed plain text (empty for link posts)."""
    raw = data.get("selftext", "") or ""
    return " ".join(html.unescape(raw).split())


def _reddit_thumbnail(data: dict) -> str:
    """Return a thumbnail URL: the ``thumbnail`` field if it is a real URL,
    else the first preview image's source, else an empty string."""
    thumb = data.get("thumbnail", "") or ""
    if thumb.startswith("http"):
        return thumb
    images = (data.get("preview", {}) or {}).get("images", [])
    if images:
        src = images[0].get("source", {}).get("url", "")
        if src:
            return html.unescape(src)
    return ""
