"""Service-layer helpers for the reminder app.

Module-level functions, following the codebase's services pattern.
"""

import logging
from datetime import datetime

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from reminder.models import Reminder

logger = logging.getLogger(__name__)


def notify_reminder_fired(reminder: Reminder, fired_at: datetime) -> None:
    """Fan out a reminder.fired message to the user's reminders channel group.

    Errors (Redis down, channel layer misconfigured, group_send raising)
    are logged and swallowed. A reminder trigger must never fail because
    the channel layer is unhealthy — email and DB writes are the source
    of truth; the top-bar bell is a nicety.
    """
    try:
        layer = get_channel_layer()
        if layer is None:
            return
        payload = {
            "uuid": str(reminder.uuid),
            "name": reminder.name,
            "note": reminder.note or "",
            "fired_at": fired_at.isoformat(),
        }
        async_to_sync(layer.group_send)(
            f"reminders.user.{reminder.user_id}",
            {"type": "reminder.fired", "reminder": payload},
        )
    except Exception:
        logger.warning(
            "Failed to fan out reminder.fired for reminder %s",
            reminder.uuid,
            exc_info=True,
        )
