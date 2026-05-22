"""Channels URL routing. Imported by config.asgi."""

from django.urls import re_path

from blob.consumers import BlobsConsumer
from metrics.consumers import MetricsConsumer
from reminder.consumers import RemindersConsumer
from todo.consumers import TodoConsumer

websocket_urlpatterns = [
    re_path(r"^ws/todos/$", TodoConsumer.as_asgi()),
    re_path(r"^ws/blobs/$", BlobsConsumer.as_asgi()),
    re_path(r"^ws/metrics/$", MetricsConsumer.as_asgi()),
    re_path(r"^ws/reminders/$", RemindersConsumer.as_asgi()),
]
