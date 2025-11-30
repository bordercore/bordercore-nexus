"""
Views for tag management, searching, and related tag operations.

This module provides Django views for pinning/unpinning tags, searching tags, managing tag aliases, retrieving todo counts, and finding related tags for a user. It also includes a ListView for tag aliases.
"""

from typing import cast

from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.db.models import QuerySet
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import redirect
from django.views.decorators.http import require_POST
from django.views.generic.list import ListView

from lib.decorators import validate_post_data

from .models import Tag, TagAlias
from .services import find_related_tags
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

    tag = Tag.objects.get(name=tag_name, user=user)
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

    tag = Tag.objects.get(name=tag_name, user=user)
    tag.unpin()

    return redirect("bookmark:overview")


@login_required
def search(request: HttpRequest) -> JsonResponse:
    """
    Search for tags matching a query for the current user.

    Retrieves the search query and optional document type and skip_tag_aliases flag from GET parameters, performs the search, and returns the results as JSON.

    Args:
        request: The HTTP request object. Expects 'query' in GET parameters, and optional 'doctype' and 'skip_tag_aliases'.

    Returns:
        JsonResponse: A JSON response containing the search results.
    """
    user = cast(User, request.user)
    tag_name = request.GET["query"].lower()
    skip_tag_aliases = request.GET.get("skip_tag_aliases", "false").lower() in {"1", "true", "yes", "on"}

    if "doctype" in request.GET:
        doctype = [request.GET["doctype"]]
    else:
        doctype = []

    matches = search_service(user, tag_name, doctype, skip_tag_aliases)

    return JsonResponse(matches, safe=False)


class TagListView(LoginRequiredMixin, ListView):
    """
    View for displaying a list of tag aliases (currently returns none).
    """
    model = TagAlias
    template_name = "tag/tag_list.html"

    def get_queryset(self) -> QuerySet:
        """
        Return an empty queryset for tag aliases.

        Returns:
            QuerySet: An empty queryset.
        """
        return TagAlias.objects.none()


@login_required
@require_POST
def add_alias(request: HttpRequest) -> JsonResponse:
    """
    Add an alias for a tag for the current user.

    Retrieves the tag name and alias name from POST data, checks for conflicts, creates the alias if valid, and returns a status message as JSON.

    Args:
        request: The HTTP request object. Expects 'tag_name' and 'alias_name' in POST data.

    Returns:
        JsonResponse: A JSON response with the status and message.
    """
    tag_name = request.POST["tag_name"]
    alias_name = request.POST["alias_name"]

    # Check that the alias doesn't already exist
    if TagAlias.objects.filter(name=alias_name):
        response = {
            "status": "Warning",
            "message": "Alias already exists"
        }
    elif Tag.objects.filter(name=alias_name):
        response = {
            "status": "Warning",
            "message": f"A tag with the name '{alias_name}' already exists"
        }
    else:
        user = cast(User, request.user)
        tag = Tag.objects.get(name=tag_name, user=user)
        tag_alias = TagAlias(name=alias_name, tag=tag, user=user)
        tag_alias.save()
        response = {
            "status": "OK",
            "message": ""
        }

    return JsonResponse(response)


@login_required
def get_todo_counts(request: HttpRequest) -> JsonResponse:
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
            return JsonResponse({"status": "Error", "message": "No tags found for user."}, status=404)
        tag_name = tag_obj.name

    tag = Tag.objects.get(name=tag_name, user=user)
    info = tag.get_todo_counts().first() or {}

    response = {
        "status": "OK",
        "info": {
            **info
        }
    }

    return JsonResponse(response)


@login_required
def get_related_tags(request: HttpRequest) -> JsonResponse:
    """
    Retrieve tags related to a given tag for a specific document type.

    This view receives a tag name and an optional document type via GET parameters, calls the find_related_tags service to find tags that co-occur with the given tag, and returns the results as a JSON response.

    Args:
        request: The HTTP request object. Expects 'tag_name' (str) and optional 'doc_type' (str) in GET parameters.

    Returns:
        JsonResponse: A JSON response containing a status and a list of related tags with their counts.
    """
    user = cast(User, request.user)
    tag_name = request.GET["tag_name"]
    doc_type = request.GET.get("doc_type", None)

    info = find_related_tags(tag_name, user, doc_type)

    response = {
        "status": "OK",
        "info": info
    }

    return JsonResponse(response)
