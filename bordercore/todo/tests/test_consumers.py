"""Tests for the Todo WebSocket consumer."""

import pytest
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator

from accounts.tests.factories import UserFactory
from todo.consumers import TodoConsumer


@pytest.mark.asyncio
async def test_anonymous_connection_is_rejected():
    communicator = WebsocketCommunicator(TodoConsumer.as_asgi(), "/ws/todos/")
    connected, close_code = await communicator.connect()
    assert connected is False
    assert close_code == 4401


@pytest.mark.django_db
@pytest.mark.asyncio
async def test_group_message_sends_ping_to_client():
    from asgiref.sync import sync_to_async
    user = await sync_to_async(UserFactory)()

    communicator = WebsocketCommunicator(TodoConsumer.as_asgi(), "/ws/todos/")
    communicator.scope["user"] = user
    connected, _ = await communicator.connect()
    assert connected is True

    layer = get_channel_layer()
    await layer.group_send(
        f"todos.user.{user.id}",
        {"type": "todos.changed"},
    )

    msg = await communicator.receive_json_from(timeout=2)
    assert msg == {"type": "ping"}

    await communicator.disconnect()
