"""Per-domain request pacing for polite feed fetching."""
from __future__ import annotations

import time
from collections.abc import Callable
from urllib.parse import urlparse


class DomainThrottle:
    """Enforce a minimum interval between requests to the same domain.

    Requests to distinct domains are never delayed; only repeated hits to the
    same ``netloc`` (e.g. every reddit.com feed) are spaced out. The clock and
    sleep functions are injectable so the spacing logic is testable without
    real time.
    """

    def __init__(
        self,
        min_interval: float,
        *,
        sleep: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        self.min_interval = min_interval
        self._sleep = sleep
        self._monotonic = monotonic
        self._last_request: dict[str, float] = {}

    def wait(self, url: str) -> None:
        """Block until it is polite to request ``url``'s domain, then mark now.

        Not thread-safe: use one instance per worker. ``min_interval=0`` disables
        pacing. URLs with an empty ``netloc`` (e.g. relative URLs) all share a
        single bucket; feed URLs are expected to be absolute.
        """
        netloc = urlparse(url).netloc
        now = self._monotonic()
        last = self._last_request.get(netloc)
        if last is not None:
            remaining = self.min_interval - (now - last)
            if remaining > 0:
                self._sleep(remaining)
                # Record the intended wake time, not the post-sleep clock reading,
                # so sleep scheduling jitter cannot accumulate and let successive
                # requests slip under min_interval over a long run.
                now = last + self.min_interval
        self._last_request[netloc] = now
