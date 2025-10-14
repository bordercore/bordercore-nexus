
"""
Views for listing, sorting, updating, and validating RSS/Atom feeds.
"""
from __future__ import annotations

import http.client
from typing import Any, Dict, List, Optional, TypedDict, cast
from urllib.parse import unquote

import feedparser
import requests
from feed.models import Feed
from rest_framework.decorators import api_view

from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.db.models import QuerySet
from django.http import HttpRequest, JsonResponse
from django.utils.decorators import method_decorator
from django.views.generic.list import ListView

from accounts.models import UserFeed


class FeedItemPayload(TypedDict):
    """Serialized representation of a single feed item for the template context."""

    id: int
    link: str
    title: str


class FeedPayload(TypedDict, total=False):
    """Serialized representation of a Feed for the template context."""

    id: int
    uuid: Any
    name: str
    lastCheck: str
    lastResponse: Optional[str | int]
    homepage: Optional[str]
    url: str
    feedItems: List[FeedItemPayload]


@method_decorator(login_required, name="dispatch")
class FeedListView(ListView):
    """Display the current user's feeds and their items."""

    template_name = "feed/index.html"

    def get_queryset(self) -> QuerySet[Feed]:
        """Get the queryset of feeds for the current user.

        Returns:
            QuerySet of the user's feeds.
        """
        user = cast(User, self.request.user)
        return (
            user.userprofile.feeds.all()
            .order_by("userfeed__sort_order")
            .prefetch_related("feeditem_set")
        )

    def get_context_data(self, **kwargs: Any) -> Dict[str, Any]:
        """Build template context with serialized feeds and the active feed.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            dict: A context dictionary including:
                - "title": Static page title.
                - "feed_list": A list of serialized feeds.
                - "current_feed": The serialized feed corresponding to the
                  user's current selection (by session or fallback).
        """
        context = super().get_context_data(**kwargs)

        context["title"] = "Feed List"

        feed_list: List[FeedPayload] = [
            {
                "id": feed.id,
                "uuid": feed.uuid,
                "name": feed.name,
                "lastCheck": (
                    feed.last_check.strftime("%b %d, %Y, %I:%M %p") if feed.last_check else "N/A"
                ),
                "lastResponse": (
                    http.client.responses.get(feed.last_response_code, feed.last_response_code)
                    if feed.last_response_code
                    else None
                ),
                "homepage": feed.homepage,
                "url": feed.url,
                "feedItems": [
                    {
                        "id": item.id,
                        "link": item.link,
                        "title": item.title,
                    }
                    for item in feed.feeditem_set.all()
                ],
            }
            for feed in self.object_list
        ]
        context["feed_list"] = feed_list

        user = cast(User, self.request.user)
        current_feed_id: int = Feed.get_current_feed_id(user, self.request.session)
        current_feed_candidates: List[FeedPayload] = [
            x for x in feed_list if x["id"] == current_feed_id
        ]

        # Preserve original indexing behavior while satisfying mypy.
        context["current_feed"] = cast(FeedPayload, current_feed_candidates[0])

        return context


@login_required
def sort_feed(request: HttpRequest) -> JsonResponse:
    """Reorder a feed within the current user's list.

    Expects POST form fields:
        - ``feed_id``: The feed's integer ID.
        - ``position``: The new 0-based position in the list.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with operation status.
    """
    feed_id = int(request.POST["feed_id"])
    new_position = int(request.POST["position"])

    user = cast(User, request.user)
    s = UserFeed.objects.get(userprofile=user.userprofile, feed__id=feed_id)
    UserFeed.reorder(s, new_position)

    return JsonResponse({"status": "OK"}, safe=False)


@api_view(["GET"])
def update_feed_list(request: HttpRequest, feed_uuid: str) -> JsonResponse:
    """Trigger a network refresh for a feed and return counts.

    Args:
        request: The HTTP request object.
        feed_uuid: The UUID of the feed to refresh.

    Returns:
        Json response with updated count and status.
    """
    feed = Feed.objects.get(uuid=feed_uuid)
    updated_count = feed.update()
    status: Dict[str, Any] = {"status": "OK", "updated_count": updated_count}

    return JsonResponse(status, safe=False)


@login_required
def check_url(request: HttpRequest, url: str) -> JsonResponse:
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

    r = requests.get(url, timeout=10)
    if r.status_code != 200:
        status: Dict[str, Any] = {
            "status": "Error",
            "status_code": r.status_code,
            "error": r.text,
        }
    else:
        d: Any = feedparser.parse(r.text)
        status = {
            "status": "OK",
            "status_code": r.status_code,
            "entry_count": len(d.entries),
        }

    return JsonResponse(status, safe=False)
