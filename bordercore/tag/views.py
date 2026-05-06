"""
Views for tag management, searching, and related tag operations.

This module provides Django views for pinning/unpinning tags, searching tags, managing tag aliases, retrieving todo counts, and finding related tags for a user.
"""

from typing import cast

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from django.contrib.auth.decorators import login_required
from django.core.cache import cache
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.db.models import QuerySet
from django.http import HttpRequest, HttpResponse, HttpResponseNotFound
from django.shortcuts import redirect
from django.views.decorators.http import require_POST
from django.views.generic import DetailView

from lib.decorators import validate_post_data
from lib.mixins import get_user_object_or_404

from .models import Tag, TagAlias
from .services import find_related_tags, get_alias_library
from .services import search as search_service


@login_required
@require_POST
@validate_post_data("tag")
def pin(request: HttpRequest) -> HttpResponse:
    """
    Pin a tag for the current user.

    Retrieves the tag name from the POST data, pins the tag for the user, and redirects to the bookmark overview page.

    Args:
        request: The HTTP request object. Expects 'tag' in POST data.

    Returns:
        HttpResponse: Redirects to the bookmark overview page.
    """
    user = cast(User, request.user)
    tag_name = request.POST["tag"]

    tag = get_user_object_or_404(user, Tag, name=tag_name)
    tag.pin()

    return redirect("bookmark:overview")


@login_required
@require_POST
@validate_post_data("tag")
def unpin(request: HttpRequest) -> HttpResponse:
    """
    Unpin a tag for the current user.

    Retrieves the tag name from the POST data, unpins the tag for the user, and redirects to the bookmark overview page.

    Args:
        request: The HTTP request object. Expects 'tag' in POST data.

    Returns:
        HttpResponse: Redirects to the bookmark overview page.
    """
    user = cast(User, request.user)
    tag_name = request.POST["tag"]

    tag = get_user_object_or_404(user, Tag, name=tag_name)
    tag.unpin()

    return redirect("bookmark:overview")


@api_view(["GET"])
def search(request: HttpRequest) -> Response:
    """
    Search for tags matching a query for the current user.

    Retrieves the search query and optional document type and skip_tag_aliases flag from GET parameters, performs the search, and returns the results as JSON.

    Args:
        request: The HTTP request object. Expects 'query' in GET parameters, and optional 'doctype' and 'skip_tag_aliases'.

    Returns:
        JsonResponse: A JSON response containing the search results.
    """
    user = cast(User, request.user)
    query = request.GET.get("query")
    if not query:
        return Response({"error": "Missing required parameter: query"}, status=400)
    tag_name = query.lower()
    skip_tag_aliases = request.GET.get("skip_tag_aliases", "false").lower() in {"1", "true", "yes", "on"}

    if "doctype" in request.GET:
        doctype = [request.GET["doctype"]]
    else:
        doctype = []

    matches = search_service(user, tag_name, doctype, skip_tag_aliases)

    return Response(matches)


@login_required
def tag_list_redirect(request: HttpRequest) -> HttpResponse:
    """
    Entry point for the navbar 'tags' link.

    Picks a random tag belonging to the current user and redirects
    to its Curator page (tag:detail). If the user has no tags yet,
    returns 404.
    """
    user = cast(User, request.user)
    tag = Tag.objects.filter(user=user).order_by("?").first()
    if tag is None:
        return HttpResponseNotFound("No tags yet — create one first.")
    return redirect("tag:detail", name=tag.name)


@api_view(["POST"])
@validate_post_data("tag_name", "alias_name")
def add_alias(request: HttpRequest) -> Response:
    """
    Add an alias for a tag for the current user.

    Retrieves the tag name and alias name from POST data, checks for conflicts, creates the alias if valid, and returns a status message as JSON.

    Args:
        request: The HTTP request object. Expects 'tag_name' and 'alias_name' in POST data.

    Returns:
        JsonResponse: A JSON response with the status and message.
    """
    user = cast(User, request.user)
    tag_name = request.POST["tag_name"]
    alias_name = request.POST["alias_name"]

    # Check that the alias doesn't already exist for this user
    if TagAlias.objects.filter(name=alias_name, user=user).exists():
        return Response(
            {"detail": "Alias already exists"},
            status=400,
        )
    elif Tag.objects.filter(name=alias_name, user=user).exists():
        return Response(
            {"detail": f"A tag with the name '{alias_name}' already exists"},
            status=400,
        )

    tag = get_user_object_or_404(user, Tag, name=tag_name)
    tag_alias = TagAlias(name=alias_name, tag=tag, user=user)
    tag_alias.save()

    return Response({"uuid": str(tag_alias.uuid)}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def get_todo_counts(request: HttpRequest) -> Response:
    """
    Returns todo count information for a tag associated with the current user.

    If a "tag_name" parameter is present in the GET request, retrieves the tag with that name.
    Otherwise, selects a random tag belonging to the user.

    Returns:
        JsonResponse: A JSON response containing:
            - status: "OK" if a tag is found, or "Error" if no tags exist for the user.
            - info: A dictionary with annotated counts of related objects for the selected tag.
    """

    user = cast(User, request.user)
    if "tag_name" in request.GET:
        tag_name = request.GET["tag_name"]
    else:
        tag_obj = Tag.objects.filter(user=user).order_by("?").first()
        if tag_obj is None:
            return Response({"detail": "No tags found for user."}, status=404)
        tag_name = tag_obj.name

    tag = get_user_object_or_404(user, Tag, name=tag_name)
    info = tag.get_related_counts().first() or {}

    return Response({
        "info": {
            **info
        }
    })


@api_view(["GET"])
def get_related_tags(request: HttpRequest) -> Response:
    """
    Retrieve tags related to a given tag for a specific document type.

    This view receives a tag name and an optional document type via GET parameters, calls the find_related_tags service to find tags that co-occur with the given tag, and returns the results as a JSON response.

    Args:
        request: The HTTP request object. Expects 'tag_name' (str) and optional 'doc_type' (str) in GET parameters.

    Returns:
        JsonResponse: A JSON response containing a status and a list of related tags with their counts.
    """
    user = cast(User, request.user)
    tag_name = request.GET.get("tag_name")
    if not tag_name:
        return Response({"error": "Missing required parameter: tag_name"}, status=400)
    doc_type = request.GET.get("doc_type", None)

    info = find_related_tags(tag_name, user, doc_type)

    return Response({"info": info})


def _tag_snapshot(tag: Tag, user: User) -> dict:
    counts = tag.get_related_counts().first() or {}
    aliases = [
        {"uuid": str(a.uuid), "name": a.name}
        for a in TagAlias.objects.filter(tag=tag, user=user).order_by("name")
    ]
    related = find_related_tags(tag.name, user, None)
    return {
        "name": tag.name,
        "created": tag.created.date().isoformat(),
        "user": user.username,
        "pinned": tag.is_pinned_for(user),
        "meta": tag.is_meta,
        "counts": {
            "blob":       {"label": "blobs",       "icon": "fa-cube",          "count": counts.get("blob__count",       0)},
            "bookmark":   {"label": "bookmarks",   "icon": "fa-bookmark",      "count": counts.get("bookmark__count",   0)},
            "album":      {"label": "albums",      "icon": "fa-compact-disc",  "count": counts.get("album__count",      0)},
            "collection": {"label": "collections", "icon": "fa-layer-group",   "count": counts.get("collection__count", 0)},
            "todo":       {"label": "todos",       "icon": "fa-square-check",  "count": counts.get("todo__count",       0)},
            "question":   {"label": "drills",      "icon": "fa-brain",         "count": counts.get("question__count",   0)},
            "song":       {"label": "songs",       "icon": "fa-music",         "count": counts.get("song__count",       0)},
        },
        "aliases": aliases,
        "related": related,
    }


class TagDetailView(LoginRequiredMixin, DetailView):
    """
    Render the Tag Curator page for a single tag belonging to the current user.

    Bootstraps everything the React entry needs: the active tag's snapshot
    (counts, aliases, related), the user's full alias library, and the list
    of every tag name (for the forge target select).
    """
    model = Tag
    template_name = "tag/tag_detail.html"
    context_object_name = "tag"
    slug_field = "name"
    slug_url_kwarg = "name"

    def get_queryset(self) -> QuerySet:
        user = cast(User, self.request.user)
        return Tag.objects.filter(user=user)

    def get_context_data(self, **kwargs: object) -> dict:
        ctx = super().get_context_data(**kwargs)
        user = cast(User, self.request.user)
        tag = ctx["tag"]
        ctx["bootstrap"] = {
            "active_name": tag.name,
            "tag": _tag_snapshot(tag, user),
            "alias_library": get_alias_library(user),
            "tag_names": list(
                Tag.objects.filter(user=user).order_by("name").values_list("name", flat=True)
            ),
        }
        ctx["title"] = f"#{tag.name}"
        return ctx


@login_required
@require_POST
@validate_post_data("tag", "value")
def set_meta(request: HttpRequest) -> HttpResponse:
    """
    Set the is_meta flag on a tag owned by the current user.
    """
    user = cast(User, request.user)
    tag_name = request.POST["tag"]
    value = request.POST["value"].lower() in {"1", "true", "yes", "on"}

    tag = get_user_object_or_404(user, Tag, name=tag_name)
    tag.is_meta = value
    tag.save()
    cache.delete(f"meta_tags_{user.id}")  # invalidate Tag.get_meta_tags cache
    return HttpResponse(status=200)


@api_view(["GET"])
def snapshot(request: HttpRequest, name: str) -> Response:
    """
    Return the JSON snapshot for a tag (the same shape `bootstrap.tag`
    has on the detail page) for client-side active-tag switches.
    """
    user = cast(User, request.user)
    tag = get_user_object_or_404(user, Tag, name=name)
    return Response(_tag_snapshot(tag, user))
