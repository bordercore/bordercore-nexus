"""WebSocket consumer for live reminder fan-out.

Per-user push channel. When manage.py trigger_reminders successfully
triggers a reminder, reminder.services.notify_reminder_fired sends a
{"type": "reminder.fired", "reminder": {...}} message to group
reminders.user.<id>. This consumer forwards the message body to the
connected browser as-is — unlike the todo consumer's ping-and-refetch
pattern, the client needs the reminder payload itself to render the
indicator (there is no server-side state to refetch).
"""

from typing import Any

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class RemindersConsumer(AsyncJsonWebsocketConsumer):
    """Per-user push channel for /reminders/ fire events."""

    group_name: str | None = None

    async def connect(self) -> None:
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return
        self.group_name = f"reminders.user.{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code: int) -> None:
        if self.group_name is not None:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def reminder_fired(self, event: dict[str, Any]) -> None:
        """Forward the reminder.fired payload to the connected client.

        Channels routes group messages with type "reminder.fired" to this
        method (dots become underscores). Sends the full reminder body so
        the client can render the popover without an additional fetch.
        """
        await self.send_json({"type": "reminder.fired", "reminder": event["reminder"]})
