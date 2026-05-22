"""Tests for the Reminders WebSocket consumer."""

import pytest
from asgiref.sync import sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator

from accounts.tests.factories import UserFactory
from reminder.consumers import RemindersConsumer


async def test_anonymous_connection_is_rejected():
    communicator = WebsocketCommunicator(RemindersConsumer.as_asgi(), "/ws/reminders/")
    connected, close_code = await communicator.connect()
    assert connected is False
    assert close_code == 4401


@pytest.mark.django_db
async def test_group_message_forwards_payload_to_client():
    user = await sync_to_async(UserFactory)()

    communicator = WebsocketCommunicator(RemindersConsumer.as_asgi(), "/ws/reminders/")
    communicator.scope["user"] = user
    connected, _ = await communicator.connect()
    assert connected is True

    layer = get_channel_layer()
    payload = {
        "uuid": "9a3e0000-0000-0000-0000-000000000001",
        "name": "Pay rent",
        "note": "Use Zelle",
        "fired_at": "2026-05-22T14:00:00-05:00",
    }
    await layer.group_send(
        f"reminders.user.{user.id}",
        {"type": "reminder.fired", "reminder": payload},
    )

    msg = await communicator.receive_json_from(timeout=2)
    assert msg == {"type": "reminder.fired", "reminder": payload}

    await communicator.disconnect()
