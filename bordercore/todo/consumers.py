"""WebSocket consumer for live Todo updates."""

from typing import Any

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class TodoConsumer(AsyncJsonWebsocketConsumer):
    """Per-user push channel for /todo/ page refetch pings."""

    group_name: str | None = None

    async def connect(self) -> None:
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return
        self.group_name = f"todos.user.{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code: int) -> None:
        if self.group_name is not None:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def todos_changed(self, event: dict[str, Any]) -> None:
        """Handler for the 'todos.changed' group message.

        Channels routes group messages to a method named after the message
        'type', with dots replaced by underscores. Signals send
        {"type": "todos.changed"} to fan out to every consumer in the
        user's group.
        """
        await self.send_json({"type": "ping"})
