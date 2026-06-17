"""Reddit application-only OAuth client and listing parsing.

Reddit aggressively rate-limits unauthenticated ``.rss`` requests from
datacenter IPs (HTTP 429). Fetching through application-only OAuth against
``oauth.reddit.com`` raises that ceiling to ~100 requests/minute. The token
endpoint lives on ``www.reddit.com``; authenticated API calls go to
``oauth.reddit.com`` and return JSON (not RSS), so Reddit feeds are mapped
from JSON listings rather than parsed with feedparser.
"""
from __future__ import annotations

import time
from collections.abc import Callable

import requests

from lib.constants import (
    FEED_FETCH_MAX_RETRIES,
    FEED_USER_AGENT,
    REDDIT_OAUTH_API_BASE,
    REDDIT_OAUTH_TOKEN_URL,
)

# Imported at module level (not method level) because this module is itself
# imported lazily by feed.models, so feed.models is fully initialized by the
# time this runs — no circular-import risk in this direction.
from feed.models import RETRYABLE_STATUS, _retry_delay


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
