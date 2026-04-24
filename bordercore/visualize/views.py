"""
Views for the Constellation visualization page.
"""
from __future__ import annotations

from typing import cast

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.core.cache import cache
from django.views.generic import TemplateView

from .services import build_graph

GRAPH_CACHE_TTL_SECONDS = 60
ALLOWED_LAYERS = ("direct", "tags", "collections")


class ConstellationPageView(LoginRequiredMixin, TemplateView):
    """Serve the Constellation page shell; React mounts inside."""

    template_name = "visualize/constellation.html"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def graph_api(request: Request) -> Response:
    """Return the full node/edge payload for the current user.

    Query params:
        layers: comma-separated subset of {direct, tags, collections}.
            Defaults to "direct,tags".
    """
    user = cast(User, request.user)

    raw = request.query_params.get("layers", "direct,tags")
    layers = {token.strip() for token in raw.split(",") if token.strip() in ALLOWED_LAYERS}
    if not layers:
        layers = {"direct", "tags"}
    # Direct is always implicit.
    layers.add("direct")

    cache_key = f"viz:graph:{user.pk}:{','.join(sorted(layers))}"
    payload = cache.get(cache_key)
    if payload is None:
        payload = build_graph(user=user, layers=layers)
        cache.set(cache_key, payload, GRAPH_CACHE_TTL_SECONDS)

    return Response(payload)
