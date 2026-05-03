
"""
Views for listing, sorting, updating, and validating RSS/Atom feeds.
"""
from __future__ import annotations

import http.client
import ipaddress
import json
import socket
from http import HTTPStatus
from typing import Any, TypedDict, cast
from urllib.parse import unquote, urlparse

import feedparser
import requests
from feed.models import Feed, FeedItem, UserFeedItemState
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from lib.constants import USER_AGENT

from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.db.models import Prefetch, QuerySet
from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.generic.list import ListView

from accounts.models import UserFeed
from lib.decorators import validate_post_data


class FeedItemPayload(TypedDict):
    """Serialized representation of a single feed item for the template context."""

    id: int
    link: str
    title: str
    pubDate: str
    readAt: str | None
    summary: str
    thumbnailUrl: str


class FeedPayload(TypedDict, total=False):
    """Serialized representation of a Feed for the template context."""

    id: int
    uuid: Any
    name: str
    lastCheck: str | None
    lastResponse: str | int | None
    lastResponseCode: int | None
    homepage: str | None
    url: str
    feedItems: list[FeedItemPayload]


class FeedListView(LoginRequiredMixin, ListView):
    """Display the current user's feeds and their items."""

    template_name = "feed/index.html"

    def get_queryset(self) -> QuerySet[Feed]:
        """Get the queryset of feeds for the current user, with per-user read state.

        Returns:
            QuerySet of the user's feeds, prefetched with their items and the
            current user's read state for each item (one extra DB round-trip).
        """
        user = cast(User, self.request.user)
        user_state_qs = UserFeedItemState.objects.filter(user=user)
        return (
            user.userprofile.feeds.all()
            .order_by("userfeed__sort_order")
            .prefetch_related(
                "feeditem_set",
                Prefetch(
                    "feeditem_set__user_states",
                    queryset=user_state_qs,
                    to_attr="prefetched_user_states",
                ),
            )
        )

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Build template context with serialized feeds and the active feed."""
        context = super().get_context_data(**kwargs)
        context["title"] = "Feed List"

        feed_list: list[FeedPayload] = [
            {
                "id": feed.id,
                "uuid": feed.uuid,
                "name": feed.name,
                "lastCheck": feed.last_check.isoformat() if feed.last_check else None,
                "lastResponse": (
                    http.client.responses.get(feed.last_response_code, feed.last_response_code)
                    if feed.last_response_code
                    else None
                ),
                "lastResponseCode": feed.last_response_code,
                "homepage": feed.homepage,
                "url": feed.url,
                "feedItems": [
                    {
                        "id": item.id,
                        "link": item.link,
                        "title": item.title,
                        "pubDate": item.pub_date.isoformat(),
                        "readAt": _read_at(item),
                        "summary": item.summary,
                        "thumbnailUrl": item.thumbnail_url,
                    }
                    for item in feed.feeditem_set.all()
                ],
            }
            for feed in self.object_list
        ]
        context["feed_list"] = json.dumps(feed_list, default=str)

        user = cast(User, self.request.user)
        current_feed_id = Feed.get_current_feed_id(user, self.request.session)
        current_feed = next((x for x in feed_list if x["id"] == current_feed_id), None)
        if current_feed is None and feed_list:
            current_feed = feed_list[0]
        context["current_feed"] = json.dumps(current_feed, default=str) if current_feed else "null"

        return context


def _read_at(item: FeedItem) -> str | None:
    """Return the current user's read_at ISO timestamp for an item, or None."""
    states = getattr(item, "prefetched_user_states", [])
    if not states:
        return None
    state = states[0]
    return state.read_at.isoformat() if state.read_at else None


@api_view(["POST"])
@validate_post_data("feed_id", "position")
def sort_feed(request: HttpRequest) -> Response:
    """Reorder a feed within the current user's list.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with operation status.
    """
    try:
        feed_id = int(request.POST.get("feed_id", "").strip())
        new_position = int(request.POST.get("position", "").strip())
    except (TypeError, ValueError):
        return Response({"detail": "Invalid feed_id or position"}, status=400)

    user = cast(User, request.user)
    s = get_object_or_404(UserFeed, userprofile=user.userprofile, feed__id=feed_id)
    UserFeed.reorder(s, new_position)

    return Response()


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_feed_list(request: HttpRequest, feed_uuid: str) -> Response:
    """Trigger a network refresh for a feed and return counts.

    Args:
        request: The HTTP request object.
        feed_uuid: The UUID of the feed to refresh.

    Returns:
        JSON response with updated count and status.
    """
    # We do not need to filter the feed by a user because this endpoint
    #  is only called by an AWS Lambda function using a service account.
    feed = get_object_or_404(Feed, uuid=feed_uuid)

    try:
        updated_count = feed.update()
    except Exception as e:
        return Response({"detail": str(e)}, status=HTTPStatus.SERVICE_UNAVAILABLE)

    return Response({"updated_count": updated_count})


@api_view(["GET"])
def check_url(request: HttpRequest, url: str) -> Response:
    """Validate a URL as an RSS/Atom feed by fetching and parsing it.

    The URL is unquoted, fetched, and parsed with ``feedparser`` to count
    entries.

    Args:
        request: The HTTP request object.
        url: The percent-encoded URL to check.

    Returns:
        JSON response with either ``OK`` with the entry count
        or ``Error`` with status and server-provided text.
    """
    url = unquote(url)

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return Response({"detail": "Invalid URL scheme"}, status=400)

    hostname = parsed.hostname
    if hostname:
        try:
            ip = socket.gethostbyname(hostname)
            ip_obj = ipaddress.ip_address(ip)
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved:
                return Response(
                    {"detail": "Access to private/internal IPs is not allowed"},
                    status=400,
                )
        except (socket.gaierror, ValueError):
            pass

    try:
        headers: dict[str, str] = {"user-agent": USER_AGENT}
        r = requests.get(url, headers=headers, timeout=10)
    except requests.RequestException as e:
        return Response({"detail": str(e)}, status=400)

    if r.status_code != HTTPStatus.OK:
        return Response({
            "detail": f"Feed returned HTTP {r.status_code}",
            "status_code": r.status_code,
        }, status=400)

    d: Any = feedparser.parse(r.text)
    return Response({
        "status_code": r.status_code,
        "entry_count": len(d.entries),
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_item_read(request: HttpRequest, pk: int) -> Response:
    """Mark a single feed item as read for the current user.

    Idempotent: calling twice returns the timestamp of the first call.

    Args:
        request: The HTTP request object.
        pk: The primary key of the FeedItem to mark.

    Returns:
        JSON response with the read_at timestamp.
    """
    user = cast(User, request.user)
    item = get_object_or_404(FeedItem, pk=pk, feed__user=user)

    state, created = UserFeedItemState.objects.get_or_create(
        user=user,
        feed_item=item,
        defaults={"read_at": timezone.now()},
    )
    if not created and state.read_at is None:
        state.read_at = timezone.now()
        state.save(update_fields=["read_at", "modified"])

    return Response({"read_at": state.read_at.isoformat() if state.read_at else None})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_feed_read(request: HttpRequest, feed_uuid: str) -> Response:
    """Mark every item in a feed as read for the current user.

    Idempotent. Creates UserFeedItemState rows for items that don't have
    one yet; updates existing rows where ``read_at`` is null.

    Args:
        request: The HTTP request object.
        feed_uuid: The UUID of the feed.

    Returns:
        JSON response with the count of items newly marked.
    """
    user = cast(User, request.user)
    feed = get_object_or_404(Feed, uuid=feed_uuid, user=user)

    now = timezone.now()
    items = list(feed.feeditem_set.all().only("id"))
    if not items:
        return Response({"marked": 0})

    existing = {
        s.feed_item_id: s
        for s in UserFeedItemState.objects.filter(user=user, feed_item__in=items)
    }

    to_create = [
        UserFeedItemState(user=user, feed_item_id=item.id, read_at=now)
        for item in items
        if item.id not in existing
    ]
    UserFeedItemState.objects.bulk_create(to_create, batch_size=500)

    to_update = [s for s in existing.values() if s.read_at is None]
    for s in to_update:
        s.read_at = now
    UserFeedItemState.objects.bulk_update(to_update, ["read_at", "modified"], batch_size=500)

    return Response({"marked": len(to_create) + len(to_update)})
