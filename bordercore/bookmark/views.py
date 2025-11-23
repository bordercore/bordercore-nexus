"""Views for the bookmark application.

This module contains views for managing bookmarks, including creating,
editing, deleting, importing, and organizing bookmarks with tags.
"""
import datetime
import html
import re
from typing import TYPE_CHECKING, Any, cast
from urllib.parse import unquote

import pytz

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.contrib.postgres.aggregates import ArrayAgg
from django.core.exceptions import ObjectDoesNotExist
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Count, QuerySet
from django.forms import BaseModelForm
from django.http import (Http404, HttpRequest, HttpResponse,
                         HttpResponseRedirect, JsonResponse)
from django.shortcuts import redirect, render
from django.urls import reverse_lazy
from django.utils.decorators import method_decorator
from django.views.decorators.http import require_POST
from django.views.generic import CreateView, DeleteView, ListView, UpdateView
from django.views.generic.edit import ModelFormMixin

from accounts.models import UserTag
from blob.models import Blob
from bookmark.forms import BookmarkForm
from bookmark.models import IMPORTANCE_HIGH, Bookmark
from lib.decorators import validate_post_data
from lib.mixins import FormRequestMixin
from lib.util import get_pagination_range, parse_title_from_url
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
    b = Bookmark.objects.get(user=user, uuid=bookmark_uuid)
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

        if "importance" in self.request.POST:
            bookmark.importance = IMPORTANCE_HIGH

        bookmark.save()

        with transaction.atomic():

            for tag in bookmark.tags.all():
                s = TagBookmark.objects.get(tag=tag, bookmark=bookmark)
                s.delete()

            # Delete all existing tags
            bookmark.tags.clear()

            # Then add the tags specified in the form
            for tag in form.cleaned_data["tags"]:
                bookmark.tags.add(tag)

        bookmark.index_bookmark()
        bookmark.snarf_favicon()

        messages.add_message(self.request, messages.INFO, "Bookmark Edited", extra_tags="noAutoHide")

        return super().form_valid(form)


class BookmarkUpdateView(FormRequestMixin, BookmarkFormValidMixin, UpdateView):
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
        context["tags"] = [x.name for x in self.object.tags.all()]
        context["back_references"] = Blob.back_references(self.object.uuid)
        context["related_nodes"] = self.object.related_nodes()

        return context


@method_decorator(login_required, name="dispatch")
class BookmarkCreateView(FormRequestMixin, BookmarkFormValidMixin, CreateView):
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
        return context


@method_decorator(login_required, name="dispatch")
class BookmarkDeleteView(LoginRequiredMixin, DeleteView):
    """View for deleting a bookmark.

    Allows users to delete their own bookmarks.
    """

    model = Bookmark
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    success_url = reverse_lazy("bookmark:overview")

    def get_queryset(self) -> QuerySet[Bookmark]:
        """Get the queryset filtered to the current user's bookmarks.

        Returns:
            Bookmarks owned by the logged-in user.
        """
        # Filter the queryset to only include objects owned by the logged-in user
        user = cast(User, self.request.user)
        return self.model.objects.filter(user=user)


@login_required
def delete(request: HttpRequest, bookmark_id: int | None = None) -> JsonResponse:
    """Delete a bookmark via AJAX request.

    Args:
        request: The HTTP request.
        bookmark_id: The ID of the bookmark to delete (optional).

    Returns:
        JSON response with "OK" status.
    """
    if bookmark_id is None:
        raise Http404("Bookmark ID is required")
    user = cast(User, request.user)
    bookmark = Bookmark.objects.get(user=user, pk=bookmark_id)
    bookmark.delete()

    return JsonResponse("OK", safe=False)


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
    url = request.GET["url"]
    name = html.unescape(request.GET["name"])

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
    except ObjectDoesNotExist:
        b = Bookmark(is_pinned=False, user=user, url=url, name=name)
        b.save()
        b.index_bookmark()
        b.snarf_favicon()

    return redirect("bookmark:update", b.uuid)


@login_required
def get_tags_used_by_bookmarks(request: HttpRequest) -> JsonResponse:
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

    return JsonResponse([{"label": x.name, "is_meta": x.is_meta} for x in tags], safe=False)


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
    sorted_bookmarks: list[Any] = []

    bare_count = Bookmark.objects.bare_bookmarks_count(user)

    pinned_tags = user.userprofile.pinned_tags.all().annotate(
        bookmark_count=Count("tagbookmark")
    ).order_by(
        "usertag__sort_order"
    ).values()

    return render(request, "bookmark/index.html",
                  {
                      "bookmarks": sorted_bookmarks,
                      "untagged_count": bare_count,
                      "pinned_tags": list(pinned_tags),
                      "tag": request.GET.get("tag", None),
                      "title": "Bookmarks"
                  })


@method_decorator(login_required, name="dispatch")
class BookmarkListView(ListView):
    """View for listing bookmarks as JSON.

    Returns a paginated list of bookmarks filtered by search query, tag,
    or untagged status. Used for AJAX requests to load bookmarks dynamically.
    """

    paginate_by = 2
    model = Bookmark

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
        elif "tag_filter" in self.kwargs:
            query = query.filter(name__icontains=self.kwargs.get("tag_filter"))
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
        paginator = Paginator(query, BOOKMARKS_PER_PAGE)
        page_obj = paginator.get_page(page_number)

        return page_obj

    def get(self, request: HttpRequest, *args: Any, **kwargs: Any) -> JsonResponse:
        """Handle GET request for bookmark list.

        Returns a JSON response with bookmarks and pagination information.

        Args:
            request: The HTTP request.
            *args: Additional positional arguments.
            **kwargs: Additional keyword arguments.

        Returns:
            JSON response containing:
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
                    "tags": [x.name for x in x.tags.all()],
                    "thumbnail_url": x.thumbnail_url,
                    "video_duration": x.video_duration
                }
            )

        return JsonResponse(
            {
                "bookmarks": bookmarks,
                "pagination": pagination
            },
            safe=False
        )


@method_decorator(login_required, name="dispatch")
class BookmarkListTagView(BookmarkListView):
    """View for listing bookmarks filtered by a specific tag.

    Returns bookmarks associated with a particular tag, ordered by
    sort order. Includes tag-specific notes.
    """

    def get(self, request: HttpRequest, *args: Any, **kwargs: Any) -> JsonResponse:
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

        return JsonResponse(
            {
                "bookmarks": bookmarks,
                "pagination": pagination
            },
            safe=False
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


@login_required
@require_POST
@validate_post_data("tag_id", "new_position")
def sort_pinned_tags(request: HttpRequest) -> JsonResponse:
    """Move a pinned tag to a new position in the sorted list.

    Reorders a pinned tag to a new position. Returns an error if the
    position is less than 1.

    Args:
        request: The HTTP request containing:
            - tag_id: The ID of the tag to reorder
            - new_position: The new position index for the tag

    Returns:
        JSON response containing:
            - status: "OK" on success, "Error" on failure
            - message: Error message if status is "Error"
    """
    tag_id = request.POST["tag_id"]
    new_position = int(request.POST["new_position"])

    if new_position < 1:

        response = {
            "status": "Error",
            "message": f"Position cannot be < 1: {new_position}"
        }

    else:

        user = cast(User, request.user)
        tag = Tag.objects.get(user=user, id=tag_id)

        s = UserTag.objects.get(userprofile=user.userprofile, tag=tag)
        UserTag.reorder(s, new_position)

        response = {
            "status": "OK"
        }

    return JsonResponse(response, safe=False)


@login_required
@require_POST
@validate_post_data("tag", "bookmark_uuid", "position")
def sort_bookmarks(request: HttpRequest) -> JsonResponse:
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
    new_position = int(request.POST["position"])

    user = cast(User, request.user)
    tb = TagBookmark.objects.get(tag__name=tag_name, tag__user=user, bookmark__uuid=bookmark_uuid, bookmark__user=user)
    TagBookmark.reorder(tb, new_position)

    return JsonResponse({"status": "OK"}, safe=False)


@login_required
@require_POST
@validate_post_data("tag", "bookmark_uuid", "note")
def add_note(request: HttpRequest) -> JsonResponse:
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

    return JsonResponse({"status": "OK"}, safe=False)


@login_required
def get_new_bookmarks_count(request: HttpRequest, timestamp: int) -> JsonResponse:
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

    return JsonResponse(
        {
            "status": "OK",
            "count": count
        }
    )


@login_required
def get_title_from_url(request: HttpRequest) -> JsonResponse:
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
    url = unquote(request.GET["url"])

    title = parse_title_from_url(url)

    return JsonResponse(
        {
            "status": "OK",
            "title": title[1]
        }
    )


@login_required
@require_POST
@validate_post_data("bookmark_uuid", "tag_id")
def add_tag(request: HttpRequest) -> JsonResponse:
    """Add a tag to a bookmark.

    Associates a tag with a bookmark. Returns an error if the bookmark
    already has the tag. Re-indexes the bookmark after adding the tag.

    Args:
        request: The HTTP request containing:
            - bookmark_uuid: The UUID of the bookmark
            - tag_id: The ID of the tag to add

    Returns:
        JSON response containing:
            - status: "OK" on success, "Error" on failure
            - message: Error message if status is "Error"
    """
    bookmark_uuid = request.POST["bookmark_uuid"]
    tag_id = request.POST["tag_id"]

    user = cast(User, request.user)
    bookmark = Bookmark.objects.get(uuid=bookmark_uuid, user=user)
    tag = Tag.objects.get(user=user, id=tag_id)

    if tag in bookmark.tags.all():
        response = {
            "status": "Error",
            "message": f"Bookmark already has tag {tag}"
        }
    else:
        bookmark.tags.add(tag)
        bookmark.index_bookmark()
        response = {
            "status": "OK",
        }

    return JsonResponse(response)


@login_required
@require_POST
@validate_post_data("bookmark_uuid", "tag_name")
def remove_tag(request: HttpRequest) -> JsonResponse:
    """Remove a tag from a bookmark.

    Removes a tag association from a bookmark. Returns an error if the
    bookmark does not have the tag.

    Args:
        request: The HTTP request containing:
            - bookmark_uuid: The UUID of the bookmark
            - tag_name: The name of the tag to remove

    Returns:
        JSON response containing:
            - status: "OK" on success, "Error" on failure
            - message: Error message if status is "Error"
    """
    bookmark_uuid = request.POST["bookmark_uuid"]
    tag_name = request.POST["tag_name"]

    user = cast(User, request.user)
    bookmark = Bookmark.objects.get(uuid=bookmark_uuid, user=user)
    tag = Tag.objects.get(user=user, name=tag_name)

    if tag not in bookmark.tags.all():
        response = {
            "status": "Error",
            "message": f"Bookmark does not have tag {tag}"
        }
    else:
        bookmark.delete_tag(tag)
        response = {
            "status": "OK",
        }

    return JsonResponse(response)
