"""Short-lived, account-scoped import progress; readings never enter the cache."""
import logging
from contextlib import contextmanager
from time import monotonic
from typing import Any, Callable, Iterator
from uuid import UUID

from django.contrib.auth.models import User
from django.core.cache import cache

from .services import fail

logger = logging.getLogger(__name__)
Progress = Callable[..., None]
TTL = 3600


def key(user: User, identifier: UUID) -> str:
    return f"qs-import-progress:{user.pk}:{identifier}"


def get_progress(user: User, identifier: UUID) -> dict[str, Any]:
    try:
        return cache.get(key(user, identifier)) or {"stage": "waiting"}
    except Exception:
        logger.warning("Import progress cache unavailable", exc_info=True)
        return {"stage": "unavailable"}


@contextmanager
def tracking(user: User, identifier: Any) -> Iterator[Progress]:
    if not identifier:
        yield lambda stage, **values: None
        return
    try:
        progress_key = key(user, UUID(str(identifier)))
    except (ValueError, TypeError, AttributeError):
        fail("Invalid import progress ID.")
    last_stage = ""
    last_update = 0.0

    def report(stage: str, **values: Any) -> None:
        nonlocal last_stage, last_update
        now = monotonic()
        if stage == last_stage and now - last_update < 0.3:
            return
        last_stage, last_update = stage, now
        try:
            cache.set(progress_key, {"stage": stage, **values}, TTL)
        except Exception:
            # A temporary progress-cache failure must not abort an import.
            logger.warning("Unable to publish import progress", exc_info=True)

    report("processing")
    try:
        yield report
    except Exception:
        report("error")
        raise
    else:
        report("complete")
