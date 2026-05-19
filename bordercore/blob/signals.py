"""Channel-layer fan-out for the "Recently Viewed" topbar dropdown.

When user N views a Blob or Node (which inserts a RecentlyViewedBlob row
via RecentlyViewedBlob.add()), signal a recently_viewed.changed message
to group blobs.user.<N>. BlobsConsumer (listening on /ws/blobs/) forwards
each message as a {"type": "ping"} to the connected browser, which then
re-fetches /blob/api/recently-viewed/.

Wired up in BlobConfig.ready() (blob/apps.py).
"""

import logging
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save
from django.dispatch import receiver

from blob.models import RecentlyViewedBlob

logger = logging.getLogger(__name__)


def _notify(user_id: int) -> None:
    """Send the recently_viewed.changed group message for one user.

    Errors (Redis down, layer misconfigured) are logged and swallowed —
    a view-tracking write must never fail because the channel layer is
    unhealthy.
    """
    try:
        layer = get_channel_layer()
        if layer is None:
            return
        async_to_sync(layer.group_send)(
            f"blobs.user.{user_id}",
            {"type": "recently_viewed.changed"},
        )
    except Exception:
        logger.warning("Failed to send recently_viewed.changed for user %s", user_id, exc_info=True)


@receiver(post_save, sender=RecentlyViewedBlob)
def recently_viewed_saved(
    sender: type[RecentlyViewedBlob], instance: RecentlyViewedBlob, **kwargs: Any
) -> None:
    _notify(instance.user_id)
