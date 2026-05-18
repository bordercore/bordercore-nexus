"""ASGI entrypoint for Django + Channels.

Used by daphne in prod and by runserver in dev (daphne overrides runserver).
"""

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")

import django
django.setup()

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

from config.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    ),
})
