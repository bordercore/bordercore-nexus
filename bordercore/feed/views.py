
"""
Views for listing, sorting, updating, and validating RSS/Atom feeds.
"""
from __future__ import annotations

import http.client
from http import HTTPStatus
from typing import Any, Dict, List, TypedDict, cast
from urllib.parse import unquote

import feedparser
import requests
from feed.models import Feed
from rest_framework.decorators import api_view

from lib.constants import USER_AGENT

from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.db.models import QuerySet
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_POST
from django.views.generic.list import ListView

from accounts.models import UserFeed
from lib.decorators import validate_post_data


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
    lastResponse: str | int | None
    homepage: str | None
    url: str
    feedItems: List[FeedItemPayload]


class FeedListView(LoginRequiredMixin, ListView):
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
            Dictionary containing context data for the template.
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
        current_feed_id = Feed.get_current_feed_id(user, self.request.session)
        current_feed = next((x for x in feed_list if x["id"] == current_feed_id), None)
        if current_feed is None and feed_list:
            current_feed = feed_list[0]
        context["current_feed"] = cast(FeedPayload, current_feed)

        return context


@login_required
@require_POST
@validate_post_data("feed_id", "position")
def sort_feed(request: HttpRequest) -> JsonResponse:
    """Reorder a feed within the current user's list.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with operation status.
    """
    feed_id = int(request.POST.get("feed_id", "").strip())
    new_position = int(request.POST.get("position", "").strip())

    user = cast(User, request.user)
    s = UserFeed.objects.get(userprofile=user.userprofile, feed__id=feed_id)
    UserFeed.reorder(s, new_position)

    return JsonResponse({"status": "OK"})


@api_view(["POST"])
def update_feed_list(request: HttpRequest, feed_uuid: str) -> JsonResponse:
    """Trigger a network refresh for a feed and return counts.

    Args:
        request: The HTTP request object.
        feed_uuid: The UUID of the feed to refresh.

    Returns:
        Json response with updated count and status.
    """
    # We do not need to filter the feed by a user because this endpoint
    #  is only called by an AWS Lambda function using a service account.
    feed = Feed.objects.get(uuid=feed_uuid)

    try:
        updated_count = feed.update()
    except Exception as e:
        return JsonResponse({"status": "ERROR", "message": str(e)}, status=HTTPStatus.SERVICE_UNAVAILABLE)

    status: Dict[str, Any] = {"status": "OK", "updated_count": updated_count}

    return JsonResponse(status)


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

    headers: Dict[str, str] = {"user-agent": USER_AGENT}
    r = requests.get(url, headers=headers, timeout=10)
    if r.status_code != HTTPStatus.OK   :
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

    return JsonResponse(status)
