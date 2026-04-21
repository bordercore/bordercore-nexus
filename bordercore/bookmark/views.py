"""Views for the bookmark application.

This module contains views for managing bookmarks, including creating,
editing, deleting, importing, and organizing bookmarks with tags.
"""
import datetime
import html
import ipaddress
import re
import socket
from typing import TYPE_CHECKING, Any, cast
from urllib.parse import unquote, urlparse

import pytz

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.contrib.postgres.aggregates import ArrayAgg
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Count, QuerySet
from django.forms import BaseModelForm
from django.http import (Http404, HttpRequest, HttpResponse,
                         HttpResponseRedirect)
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.views.generic import CreateView, DeleteView, UpdateView
from django.views.generic.edit import ModelFormMixin

from accounts.models import UserTag
from blob.models import Blob
from bookmark.forms import BookmarkForm
from bookmark.models import Bookmark
from lib.decorators import validate_post_data
from lib.exceptions import BookmarkSearchDeleteError
from lib.mixins import FormRequestMixin, UserScopedQuerysetMixin, get_user_object_or_404
from lib.util import favicon_url, get_pagination_range, parse_title_from_url
from tag.models import Tag, TagBookmark

BOOKMARKS_PER_PAGE = 50


@login_required
def click(request: HttpRequest, bookmark_uuid: str | None = None) -> HttpResponseRedirect:
    """Redirect to a bookmark URL and mark it as viewed.

    Marks the bookmark as viewed in the daily tracking data and redirects
    to the bookmark's URL.

    Args:
        request: The HTTP request.
        bookmark_uuid: The UUID of the bookmark to click (optional).

    Returns:
        Redirect to the bookmark's URL.
    """
    user = cast(User, request.user)
    if not bookmark_uuid:
        raise Http404("Bookmark UUID is required")
    b = get_user_object_or_404(user, Bookmark, uuid=bookmark_uuid)
    if b.daily is None:
        b.daily = {}
    b.daily["viewed"] = "true"
    b.save()
    return redirect(b.url)


class BookmarkFormValidMixin(ModelFormMixin):
    """Mixin to encapsulate common logic used in Update and Create views.

    Handles saving bookmarks, managing tags, indexing bookmarks, and
    fetching favicons after form validation.
    """

    if TYPE_CHECKING:
        request: HttpRequest  # let mypy know this exists

    def form_valid(self, form: BaseModelForm) -> HttpResponse:
        """Handle a valid form submission.

        Saves the bookmark, associates it with the current user, updates
        tags, indexes the bookmark, and fetches the favicon.

        Args:
            form: The validated bookmark form.

        Returns:
            Result of the parent form_valid method.
        """
        bookmark = form.instance
        user = cast(User, self.request.user)
        bookmark.user = user

        new_object = bookmark.pk is None

        with transaction.atomic():
            bookmark.save()

            for tag in bookmark.tags.all():
                s = get_object_or_404(TagBookmark, tag=tag, bookmark=bookmark)
                s.delete()

            # Delete all existing tags
            bookmark.tags.clear()

            # Then add the tags specified in the form
            for tag in form.cleaned_data["tags"]:
                bookmark.tags.add(tag)

        bookmark.index_bookmark()
        bookmark.snarf_favicon()

        message = "Bookmark Created" if new_object else "Bookmark Edited"
        messages.add_message(self.request, messages.INFO, message, extra_tags="noAutoHide")

        return super().form_valid(form)


class BookmarkUpdateView(LoginRequiredMixin, FormRequestMixin, BookmarkFormValidMixin, UpdateView):
    """View for updating an existing bookmark.

    Handles editing of bookmarks, including updating tags and related
    objects.
    """

    model = Bookmark
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    template_name = "bookmark/update.html"
    form_class = BookmarkForm
    success_url = reverse_lazy("bookmark:overview")

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the bookmark edit form.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - action: "Edit" to indicate edit mode
                - tags: List of current tag names
                - back_references: Back references from blobs
                - related_nodes: Related node objects
        """
        context = super().get_context_data(**kwargs)
        context["action"] = "Edit"
        context["bookmark"] = self.object
        context["tags"] = [x.name for x in self.object.tags.all()]
        context["back_references"] = Blob.back_references(self.object.uuid)
        context["related_nodes"] = self.object.related_nodes()
        context["favicon_html"] = favicon_url(self.object.url)

        return context


class BookmarkCreateView(LoginRequiredMixin, FormRequestMixin, BookmarkFormValidMixin, CreateView):
    """View for creating a new bookmark.

    Handles the creation of new bookmarks, including saving tags and
    indexing the bookmark.
    """

    template_name = "bookmark/update.html"
    form_class = BookmarkForm
    success_url = reverse_lazy("bookmark:overview")

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the bookmark creation form.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - action: "Create" to indicate creation mode
        """
        context = super().get_context_data(**kwargs)
        context["action"] = "Create"
        context["tags"] = []
        context["back_references"] = []
        context["related_nodes"] = []
        context["favicon_html"] = ""
        return context


class BookmarkDeleteView(LoginRequiredMixin, UserScopedQuerysetMixin, DeleteView):
    """View for deleting a bookmark.

    Allows users to delete their own bookmarks.
    """

    model = Bookmark
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    success_url = reverse_lazy("bookmark:overview")

    def post(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        """Handle delete POST and surface ES errors nicely."""
        self.object = self.get_object()

        try:
            return super().post(request, *args, **kwargs)
        except BookmarkSearchDeleteError as exc:
            messages.error(
                request,
                str(exc),
                extra_tags="noAutoHide",
            )
            # Send user back to the edit screen for this bookmark
            return redirect("bookmark:update", uuid=self.object.uuid)


@login_required
def snarf_link(request: HttpRequest) -> HttpResponseRedirect:
    """Create a bookmark from a URL and name.

    Creates a new bookmark from the provided URL and name. If the bookmark
    already exists, redirects to the existing bookmark's edit page with
    a warning message.

    Args:
        request: The HTTP request containing:
            - url: The URL for the bookmark
            - name: The name/title for the bookmark (HTML-unescaped)

    Returns:
        Redirect to the bookmark's update page.
    """
    url = request.GET.get("url")
    name = request.GET.get("name")
    if not url or not name:
        return redirect("bookmark:overview")
    name = html.unescape(name)

    user = cast(User, request.user)

    # First verify that this url does not already exist
    try:
        b = Bookmark.objects.get(user=user, url=url)
        messages.add_message(
            request,
            messages.WARNING,
            f"Bookmark already exists and was added on <strong>{b.created.strftime('%B %d, %Y')}</strong>"
        )
        return redirect("bookmark:update", b.uuid)
    except Bookmark.DoesNotExist:
        b = Bookmark(is_pinned=False, user=user, url=url, name=name)
        b.save()
        b.index_bookmark()
        b.snarf_favicon()

    return redirect("bookmark:update", b.uuid)


@api_view(["GET"])
def get_tags_used_by_bookmarks(request: HttpRequest) -> Response:
    """Get tags that are used by bookmarks.

    Returns a list of tags that are associated with bookmarks, optionally
    filtered by a query string.

    Args:
        request: The HTTP request containing:
            - query: Optional search query to filter tag names (case-insensitive)

    Returns:
        JSON response containing a list of tag objects with:
            - label: The tag name
            - is_meta: Whether the tag is a meta tag
    """
    user = cast(User, request.user)
    tags = Tag.objects.filter(
        user=user,
        bookmark__user=user,
        name__icontains=request.GET.get("query", ""),
        bookmark__isnull=False
    ).distinct("name")

    return Response([{"label": x.name, "is_meta": x.is_meta} for x in tags])


@login_required
def overview(request: HttpRequest) -> HttpResponse:
    """Display the bookmark overview page.

    Shows the main bookmark index page with pinned tags and bookmark counts.

    Args:
        request: The HTTP request containing:
            - tag: Optional tag filter parameter

    Returns:
        Rendered bookmark index template with:
            - bookmarks: List of sorted bookmarks (currently empty)
            - untagged_count: Count of bookmarks without tags
            - pinned_tags: List of pinned tags with bookmark counts
            - tag: Optional tag filter value
            - title: Page title
    """
    user = cast(User, request.user)

    bare_count = Bookmark.objects.bare_bookmarks_count(user)

    stats = {
        "total_count": Bookmark.objects.total_count(user),
        "untagged_count": bare_count,
        "broken_count": Bookmark.objects.broken_count(user),
        "top_domain": Bookmark.objects.top_domain(user) or "\u2014",
        "tag_coverage_pct": Bookmark.objects.tag_coverage(user)["percentage"],
    }

    pinned_tags = user.userprofile.pinned_tags.all().annotate(
        bookmark_count=Count("tagbookmark")
    ).order_by(
        "usertag__sort_order"
    ).values()

    return render(request, "bookmark/index.html",
                  {
                      "untagged_count": bare_count,
                      "pinned_tags": list(pinned_tags),
                      "stats": stats,
                      "tag": request.GET.get("tag", None),
                      "title": "Bookmarks"
                  })


class BookmarkListView(APIView):
    """View for listing bookmarks as JSON.

    Returns a paginated list of bookmarks filtered by search query, tag,
    or untagged status. Used for AJAX requests to load bookmarks dynamically.
    """

    model = Bookmark

    @property
    def paginate_by(self) -> int:
        """Per-user page size, falling back to the module default."""
        user = cast(User, self.request.user)
        profile = getattr(user, "userprofile", None)
        if profile is not None and profile.bookmarks_per_page:
            return profile.bookmarks_per_page
        return BOOKMARKS_PER_PAGE

    def get_queryset(self) -> Any:
        """Get the queryset of bookmarks for the current user.

        Filters bookmarks based on search query, tag filter, or untagged
        status. Orders by creation date descending.

        Returns:
            Paginated page object containing filtered bookmarks.
        """
        user = cast(User, self.request.user)
        query = Bookmark.objects.filter(user=user)
        if "search" in self.kwargs:
            query = query.filter(name__icontains=self.kwargs.get("search"))
        else:
            query = query.filter(
                tags__isnull=True,
                blobtoobject__isnull=True,
                collectionobject__isnull=True,
            )

        query = query.prefetch_related("tags")
        query = query.only("created", "data", "last_response_code", "name", "note", "url", "uuid")
        query = query.order_by("-created")

        page_number = self.kwargs.get("page_number", 1)
        paginator = Paginator(query, self.paginate_by)
        page_obj = paginator.get_page(page_number)

        return page_obj

    def get(self, request: HttpRequest, *args: Any, **kwargs: Any) -> Response:
        """Handle GET request for bookmark list.

        Returns a JSON response with bookmarks and pagination information.

        Args:
            request: The HTTP request.
            *args: Additional positional arguments.
            **kwargs: Additional keyword arguments.

        Returns:
            Response containing:
                - bookmarks: List of bookmark dictionaries with metadata
                - pagination: Pagination information including page numbers
        """
        queryset = self.get_queryset()

        pagination = {}

        if queryset.paginator.num_pages > 1:

            page_number = self.kwargs.get("page_number", 1)

            pagination = {
                "num_pages": queryset.paginator.num_pages,
                "page_number": page_number,
                "paginate_by": self.paginate_by
            }

            pagination["range"] = get_pagination_range(
                page_number,
                queryset.paginator.num_pages,
                self.paginate_by
            )

            if queryset.has_next():
                pagination["next_page_number"] = queryset.next_page_number()
            if queryset.has_previous():
                pagination["previous_page_number"] = queryset.previous_page_number()

        bookmarks = []

        for x in queryset:
            bookmarks.append(
                {
                    "uuid": x.uuid,
                    "created": x.created.strftime("%B %d, %Y"),
                    "createdYear": x.created.strftime("%Y"),
                    "url": x.url,
                    "name": re.sub("[\n\r]", "", x.name),
                    "last_response_code": x.last_response_code,
                    "note": x.note,
                    "favicon_url": x.get_favicon_img_tag(size=16),
                    "tags": [tag.name for tag in x.tags.all()],
                    "thumbnail_url": x.thumbnail_url,
                    "video_duration": x.video_duration
                }
            )

        return Response(
            {
                "bookmarks": bookmarks,
                "pagination": pagination
            }
        )


class BookmarkListTagView(BookmarkListView):
    """View for listing bookmarks filtered by a specific tag.

    Returns bookmarks associated with a particular tag, ordered by
    sort order. Includes tag-specific notes.
    """

    def get(self, request: HttpRequest, *args: Any, **kwargs: Any) -> Response:
        """Handle GET request for tag-filtered bookmark list.

        Returns a JSON response with bookmarks filtered by tag and
        pagination information.

        Args:
            request: The HTTP request.
            *args: Additional positional arguments.
            **kwargs: Additional keyword arguments.

        Returns:
            JSON response containing:
                - bookmarks: List of bookmark dictionaries with metadata
                - pagination: Pagination information
        """
        queryset = self.get_queryset()

        pagination = {
            "num_pages": 1
        }

        bookmarks = []

        for x in queryset:
            bookmarks.append(
                {
                    "uuid": x.bookmark.uuid,
                    "created": x.bookmark.created.strftime("%B %d, %Y"),
                    "createdYear": x.bookmark.created.strftime("%Y"),
                    "url": x.bookmark.url,
                    "name": re.sub("[\n\r]", "", x.bookmark.name),
                    "last_response_code": x.bookmark.last_response_code,
                    "note": x.note,
                    "favicon_url": x.bookmark.get_favicon_img_tag(size=16),
                    "tags": getattr(x, "tags", []),  # tags is an annotated field from ArrayAgg
                    "thumbnail_url": x.bookmark.thumbnail_url,
                    "video_duration": x.bookmark.video_duration
                }
            )

        return Response(
            {
                "bookmarks": bookmarks,
                "pagination": pagination
            }
        )

    def get_queryset(self) -> QuerySet[TagBookmark]:
        """Get the queryset of TagBookmark objects filtered by tag.

        Returns TagBookmark objects for the specified tag, ordered by
        sort order, with aggregated tag names.

        Returns:
            QuerySet of TagBookmark objects with aggregated tags.
        """
        user = cast(User, self.request.user)
        return TagBookmark.objects.filter(
            tag__name=self.kwargs.get("tag_filter"),
            tag__user=user,
            bookmark__user=user,
        ).annotate(tags=ArrayAgg("bookmark__tags__name")) \
                                  .select_related("bookmark") \
                                  .order_by("sort_order")


@api_view(["POST"])
@validate_post_data("tag_id", "new_position")
def sort_pinned_tags(request: HttpRequest) -> Response:
    """Move a pinned tag to a new position in the sorted list.

    Reorders a pinned tag to a new position. Returns an error if the
    position is less than 1.

    Args:
        request: The HTTP request containing:
            - tag_id: The ID of the tag to reorder
            - new_position: The new position index for the tag

    Returns:
        JSON response containing:
            - status: "OK" on success, "ERROR" on failure
            - message: Error message if status is "ERROR"
    """
    tag_id = request.POST["tag_id"]

    try:
        new_position = int(request.POST["new_position"])
    except (TypeError, ValueError):
        return Response({"detail": "Invalid position value"}, status=400)

    if new_position < 1:
        return Response(
            {"detail": f"Position cannot be < 1: {new_position}"},
            status=400,
        )

    user = cast(User, request.user)
    tag = get_user_object_or_404(user, Tag, id=tag_id)

    s = get_object_or_404(UserTag, userprofile=user.userprofile, tag=tag)
    UserTag.reorder(s, new_position)

    return Response()


@api_view(["POST"])
@validate_post_data("tag", "bookmark_uuid", "position")
def sort_bookmarks(request: HttpRequest) -> Response:
    """Move a bookmark to a new position within a tag's bookmark list.

    Reorders a bookmark within the ordered list of bookmarks for a
    specific tag.

    Args:
        request: The HTTP request containing:
            - tag: The name of the tag
            - bookmark_uuid: The UUID of the bookmark to reorder
            - position: The new position index for the bookmark

    Returns:
        JSON response with status "OK".
    """
    tag_name = request.POST["tag"]
    bookmark_uuid = request.POST["bookmark_uuid"]

    try:
        new_position = int(request.POST["position"])
    except (TypeError, ValueError):
        return Response({"detail": "Invalid position value"}, status=400)

    user = cast(User, request.user)
    tb = get_object_or_404(TagBookmark, tag__name=tag_name, tag__user=user, bookmark__uuid=bookmark_uuid, bookmark__user=user)
    TagBookmark.reorder(tb, new_position)

    return Response()


@api_view(["POST"])
@validate_post_data("tag", "bookmark_uuid", "note")
def add_note(request: HttpRequest) -> Response:
    """Add or update a note for a bookmark-tag association.

    Updates the note field for a specific bookmark-tag relationship.
    The note is tag-specific, meaning the same bookmark can have
    different notes for different tags.

    Args:
        request: The HTTP request containing:
            - tag: The name of the tag
            - bookmark_uuid: The UUID of the bookmark
            - note: The note text to add or update

    Returns:
        JSON response with status "OK".
    """
    tag_name = request.POST["tag"]
    bookmark_uuid = request.POST["bookmark_uuid"]

    note = request.POST["note"]

    user = cast(User, request.user)
    TagBookmark.objects.filter(
        tag__name=tag_name,
        tag__user=user,
        bookmark__uuid=bookmark_uuid,
        bookmark__user=user
    ).update(note=note)

    return Response()


@api_view(["GET"])
def get_new_bookmarks_count(request: HttpRequest, timestamp: int) -> Response:
    """Get a count of bookmarks created after the specified timestamp.

    Counts all bookmarks for the current user that were created after
    the provided timestamp. The timestamp is expected to be in milliseconds
    and is converted to a datetime in US/Eastern timezone.

    Args:
        request: The HTTP request.
        timestamp: Unix timestamp in milliseconds.

    Returns:
        JSON response containing:
            - status: "OK"
            - count: Number of bookmarks created after the timestamp
    """
    user = cast(User, request.user)
    time = datetime.datetime.fromtimestamp(timestamp / 1000, pytz.timezone("US/Eastern"))
    count = Bookmark.objects.filter(user=user, created__gte=time).count()

    return Response(
        {
            "count": count
        }
    )


@api_view(["GET"])
def get_title_from_url(request: HttpRequest) -> Response:
    """Parse the title from the HTML page pointed to by a URL.

    Extracts the title from a web page by fetching and parsing the HTML.
    The URL should be URL-encoded in the request.

    Args:
        request: The HTTP request containing:
            - url: The URL to extract the title from (URL-encoded)

    Returns:
        JSON response containing:
            - status: "OK"
            - title: The extracted title from the page
    """
    url = unquote(request.GET.get("url", ""))
    if not url:
        return Response({"detail": "URL parameter is required"}, status=400)

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return Response({"detail": "Invalid URL scheme"}, status=400)

    hostname = parsed.hostname
    if hostname:
        try:
            ip = socket.gethostbyname(hostname)
            ip_obj = ipaddress.ip_address(ip)
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved:
                return Response({"detail": "Access to private/internal IPs is not allowed"}, status=400)
        except (socket.gaierror, ValueError):
            pass

    title = parse_title_from_url(url)

    return Response(
        {
            "title": title[1]
        }
    )


@api_view(["POST"])
@validate_post_data("bookmark_uuid", "tag_id")
def add_tag(request: HttpRequest) -> Response:
    """Add a tag to a bookmark.

    Associates a tag with a bookmark. Returns an error if the bookmark
    already has the tag. Re-indexes the bookmark after adding the tag.

    Args:
        request: The HTTP request containing:
            - bookmark_uuid: The UUID of the bookmark
            - tag_id: The ID of the tag to add

    Returns:
        JSON response containing:
            - status: "OK" on success, "ERROR" on failure
            - message: Error message if status is "ERROR"
    """
    bookmark_uuid = request.POST["bookmark_uuid"]
    tag_id = request.POST["tag_id"]

    user = cast(User, request.user)
    bookmark = get_user_object_or_404(user, Bookmark, uuid=bookmark_uuid)
    tag = get_user_object_or_404(user, Tag, id=tag_id)

    if tag in bookmark.tags.all():
        return Response(
            {
                "detail": f"Bookmark already has tag {tag}"
            },
            status=400
        )
    else:
        bookmark.tags.add(tag)
        bookmark.index_bookmark()
        return Response(status=status.HTTP_201_CREATED)


@api_view(["POST"])
@validate_post_data("bookmark_uuid", "tag_name")
def remove_tag(request: HttpRequest) -> Response:
    """Remove a tag from a bookmark.

    Removes a tag association from a bookmark. Returns an error if the
    bookmark does not have the tag.

    Args:
        request: The HTTP request containing:
            - bookmark_uuid: The UUID of the bookmark
            - tag_name: The name of the tag to remove

    Returns:
        JSON response containing:
            - status: "OK" on success, "ERROR" on failure
            - message: Error message if status is "ERROR"
    """
    bookmark_uuid = request.POST["bookmark_uuid"]
    tag_name = request.POST["tag_name"]

    user = cast(User, request.user)
    bookmark = get_user_object_or_404(user, Bookmark, uuid=bookmark_uuid)
    tag = get_user_object_or_404(user, Tag, name=tag_name)

    if tag not in bookmark.tags.all():
        return Response(
            {
                "detail": f"Bookmark does not have tag {tag}"
            },
            status=400
        )
    else:
        bookmark.delete_tag(tag)
        return Response(status=status.HTTP_204_NO_CONTENT)
