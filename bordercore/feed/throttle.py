"""Per-domain request pacing for polite feed fetching."""
from __future__ import annotations

import time
from collections.abc import Callable
from urllib.parse import urlparse


class DomainThrottle:
    """Enforce a minimum interval between requests to the same domain.

    Requests to distinct domains are never delayed; only repeated hits to the
    same bucket are spaced out. A bucket is the request's ``netloc`` unless its
    host matches a ``domain_overrides`` suffix, in which case the suffix is the
    bucket and its interval applies — so every ``*.reddit.com`` host shares one
    bucket paced at the reddit interval (Reddit rate-limits per IP across
    subdomains). The clock and sleep functions are injectable so the spacing
    logic is testable without real time.
    """

    def __init__(
        self,
        min_interval: float,
        *,
        sleep: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
        domain_overrides: dict[str, float] | None = None,
    ) -> None:
        self.min_interval = min_interval
        self._overrides = domain_overrides or {}
        self._sleep = sleep
        self._monotonic = monotonic
        self._last_request: dict[str, float] = {}

    def _resolve(self, netloc: str) -> tuple[str, float]:
        """Return ``(bucket_key, interval)`` for a host, honoring overrides.

        A host equal to a suffix or ending in ``.<suffix>`` buckets under that
        suffix at its interval; the longest matching suffix wins. Otherwise the
        bucket is the full ``netloc`` at ``min_interval``.
        """
        host = netloc.lower()
        best_suffix: str | None = None
        best_interval = self.min_interval
        for suffix, interval in self._overrides.items():
            if (host == suffix or host.endswith("." + suffix)) and (
                best_suffix is None or len(suffix) > len(best_suffix)
            ):
                best_suffix = suffix
                best_interval = interval
        if best_suffix is not None:
            return best_suffix, best_interval
        return netloc, self.min_interval

    def wait(self, url: str) -> None:
        """Block until it is polite to request ``url``'s bucket, then mark now.

        Not thread-safe: use one instance per worker. ``min_interval=0`` (with no
        matching override) disables pacing. URLs with an empty ``netloc`` (e.g.
        relative URLs) all share a single bucket; feed URLs are expected to be
        absolute.
        """
        bucket, interval = self._resolve(urlparse(url).netloc)
        now = self._monotonic()
        last = self._last_request.get(bucket)
        if last is not None:
            remaining = interval - (now - last)
            if remaining > 0:
                self._sleep(remaining)
                # Record the intended wake time, not the post-sleep clock reading,
                # so sleep scheduling jitter cannot accumulate and let successive
                # requests slip under the interval over a long run.
                now = last + interval
        self._last_request[bucket] = now
