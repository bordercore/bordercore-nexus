"""Channels URL routing. Imported by config.asgi."""

from django.urls import re_path

from todo.consumers import TodoConsumer

websocket_urlpatterns = [
    re_path(r"^ws/todos/$", TodoConsumer.as_asgi()),
]
