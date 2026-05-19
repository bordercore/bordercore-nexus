"""Channel-layer fan-out for the topbar failing-tests indicator.

When a MetricData row is written (typically by bin/test_runner.py via cron
or `make test_*`), signal a failed_count.changed message to group
metrics.user.<N>. MetricsConsumer (listening on /ws/metrics/) forwards
each message as a {"type": "ping"} to the connected browser, which then
re-fetches /metrics/api/failed-count/.

Wired up in MetricsConfig.ready() (metrics/apps.py).
"""

import logging
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save
from django.dispatch import receiver

from metrics.models import MetricData

logger = logging.getLogger(__name__)


def _notify(user_id: int) -> None:
    """Send the failed_count.changed group message for one user.

    Errors (Redis down, layer misconfigured) are logged and swallowed —
    a MetricData write must never fail because the channel layer is
    unhealthy.
    """
    try:
        layer = get_channel_layer()
        if layer is None:
            return
        async_to_sync(layer.group_send)(
            f"metrics.user.{user_id}",
            {"type": "failed_count.changed"},
        )
    except Exception:
        logger.warning("Failed to send failed_count.changed for user %s", user_id, exc_info=True)


@receiver(post_save, sender=MetricData)
def metric_data_saved(
    sender: type[MetricData], instance: MetricData, **kwargs: Any
) -> None:
    _notify(instance.metric.user_id)
