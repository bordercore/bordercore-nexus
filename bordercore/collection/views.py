"""Views for the collection application.

This module contains views for managing collections, collection objects,
and related operations in the collection system.
"""
from io import BytesIO
from typing import Any, cast

import humanize

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.conf import settings
from django.contrib import messages
from django.db import transaction
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.core.files.uploadedfile import UploadedFile
from django.db.models import Count, Exists, OuterRef, Q, QuerySet
from django.forms import BaseModelForm
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import reverse, reverse_lazy
from django.utils.html import format_html
from django.utils import timezone
from django.views.generic.detail import DetailView
from django.views.generic.edit import (CreateView, DeleteView, FormMixin,
                                       UpdateView)
from django.views.generic.list import ListView

from blob.models import Blob
from bookmark.models import Bookmark
from collection.forms import CollectionForm
from collection.models import Collection, CollectionObject
from lib.decorators import validate_post_data
from lib.exceptions import DuplicateObjectError
from lib.mixins import FormRequestMixin, UserScopedQuerysetMixin, get_user_object_or_404
from lib.util import calculate_sha1sum, parse_title_from_url
from tag.models import Tag


class CollectionListView(LoginRequiredMixin, FormRequestMixin, FormMixin, ListView):
    """View for displaying the collection list page.

    Shows favorite collections for the current user with their blob counts,
    tags, recent images, and metadata. Supports filtering by collection name.
    """

    form_class = CollectionForm

    def get_queryset(self) -> QuerySet[Collection]:
        user = cast(User, self.request.user)
        query = Collection.objects.filter(
            user=user,
            is_favorite=True
        )

        if "query" in self.request.GET:
            query = query.filter(name__icontains=self.request.GET["query"])

        query = query.annotate(num_blobs=Count("collectionobject"))
        query = query.prefetch_related("tags")
        query = query.order_by("-modified")

        return query

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        context = super().get_context_data(**kwargs)

        collection_list = []
        tag_counts: dict[str, int] = {}

        for c in self.object_list:
            tag_names = [t.name for t in c.tags.all()]
            for name in tag_names:
                tag_counts[name] = tag_counts.get(name, 0) + 1

            collection_list.append({
                "uuid": str(c.uuid),
                "name": c.name,
                "url": reverse("collection:detail", kwargs={"uuid": c.uuid}),
                "num_objects": c.num_blobs,
                "description": c.description or "",
                "tags": tag_names,
                "modified": humanize.naturaltime(c.modified) if c.modified else "",
                "is_favorite": c.is_favorite,
                "cover_tiles": _build_cover_tiles(c),
            })

        context["collection_list"] = collection_list
        context["tag_counts"] = tag_counts
        context["cover_url"] = settings.COVER_URL
        context["title"] = "Collection List"

        return context


def _build_cover_tiles(collection: Collection) -> list[str | None]:
    """Build a 4-element list of recent-image URLs for a collection.

    Returns up to 4 small-thumbnail blob URLs, right-padded with None.
    """
    tiles: list[str | None] = []
    for image in collection.get_recent_images(limit=4):
        tiles.append(Blob.get_cover_url_static(image["uuid"], image["file"], size="small"))
    while len(tiles) < 4:
        tiles.append(None)
    return tiles


class CollectionDetailView(LoginRequiredMixin, UserScopedQuerysetMixin, FormRequestMixin, FormMixin, DetailView):
    """View for displaying a collection detail page.

    Shows a single collection with its tags, object tags with counts,
    and collection metadata.
    """

    model = Collection
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    form_class = CollectionForm

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the collection detail view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - collection_data: Dictionary representation of the collection
                - object_tags: List of tags used by objects with counts
                - initial_tags: List of tag names on the collection
                - title: Page title
        """
        context = super().get_context_data(**kwargs)

        context["initial_tags"] = list(self.object.tags.values_list("name", flat=True))

        # Get a list of all tags used by all objects in this collection,
        #  along with their total counts
        context["object_tags"] = [
            {
                "id": x.id,
                "tag": x.name,
                "blob_count": x.blob_count
            } for x in Tag.objects.filter(
                blob__collectionobject__collection__uuid=self.object.uuid
            ).distinct().annotate(
                blob_count=Count("blob")
            ).order_by(
                "-blob_count"
            )
        ]

        # Collection data for React
        context["collection_data"] = {
            "uuid": str(self.object.uuid),
            "name": self.object.name,
            "description": self.object.description or "",
            "is_favorite": self.object.is_favorite,
            "modified": self.object.modified.strftime("%B %d, %Y") if self.object.modified else "",
            "object_count": self.object.collectionobject_set.count(),
        }
        context["title"] = f"Collection Detail :: {self.object.name}"

        return context


class CollectionCreateView(LoginRequiredMixin, FormRequestMixin, CreateView):
    """View for creating a new collection.

    Handles the creation of new collections, including saving tags
    and associating the collection with the current user.
    """

    template_name = "collection/collection_list.html"
    form_class = CollectionForm

    def form_valid(self, form: BaseModelForm) -> HttpResponseRedirect:
        """Handle a valid form submission.

        Saves the collection, associates it with the current user,
        and saves tags.

        Args:
            form: The validated collection form.

        Returns:
            Redirect to the collection list page.
        """
        collection = form.save(commit=False)
        user = cast(User, self.request.user)
        collection.user = user
        collection.save()

        # Save the tags
        form.save_m2m()

        return HttpResponseRedirect(self.get_success_url())

    def get_success_url(self) -> str:
        """Get the URL to redirect to after successful form submission.

        Returns:
            URL for the collection list page.
        """
        return reverse("collection:list")


class CollectionUpdateView(LoginRequiredMixin, UserScopedQuerysetMixin, FormRequestMixin, UpdateView):
    """View for updating an existing collection.

    Handles editing of collections, including updating tags.
    Filters collections to only show those owned by the logged-in user.
    """

    model = Collection
    form_class = CollectionForm
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def form_valid(self, form: BaseModelForm) -> HttpResponseRedirect:
        """Handle a valid form submission.

        Updates the collection and saves tags.

        Args:
            form: The validated collection form.

        Returns:
            Redirect to the success URL with a success message.
        """
        collection = form.instance
        collection.tags.set(form.cleaned_data["tags"])
        self.object = form.save()

        messages.add_message(
            self.request,
            messages.INFO,
            "Collection edited"
        )

        return HttpResponseRedirect(self.get_success_url())


class CollectionDeleteView(LoginRequiredMixin, UserScopedQuerysetMixin, DeleteView):
    """View for deleting a collection.

    Allows users to delete their own collections. Filters collections to
    only show those owned by the logged-in user.
    """

    model = Collection
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    success_url = reverse_lazy("collection:list")

    def form_valid(self, form: BaseModelForm) -> HttpResponse:
        """Handle a valid deletion form submission.

        Args:
            form: The validated deletion form.

        Returns:
            Redirect to the success URL with a success message.
        """
        messages.add_message(
            self.request,
            messages.INFO,
            format_html("Collection <strong>{}</strong> deleted", self.object.name)
        )
        return super().form_valid(form)


@api_view(["GET"])
def get_blob(request: HttpRequest, collection_uuid: str) -> Response:
    """Get a blob from a collection.

    Retrieves a blob from the specified collection based on position,
    direction, optional tag filter, and randomization settings.

    Args:
        request: The HTTP request containing:
            - direction: Direction to navigate ("next" or "prev", default: "next")
            - position: Current blob position (default: 0)
            - tag: Optional tag name to filter by
            - randomize: Whether to randomize selection (default: false)
        collection_uuid: The UUID of the collection.

    Returns:
        JSON response containing blob information.
    """
    user = cast(User, request.user)
    collection = get_user_object_or_404(user, Collection, uuid=collection_uuid)
    direction = request.GET.get("direction", "next")
    try:
        blob_position = int(request.GET.get("position", 0))
    except (ValueError, TypeError):
        return Response({"detail": "Invalid position value."}, status=400)
    tag_name = request.GET.get("tag", None)
    randomize = request.GET.get("randomize", "") == "true"

    return Response(collection.get_blob(blob_position, direction, randomize, tag_name))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_images(request: HttpRequest, collection_uuid: str) -> Response:
    """Get four recent images from a collection.

    Retrieves recent images from a collection to be used in creating
    a thumbnail image.

    Args:
        request: The HTTP request.
        collection_uuid: The UUID of the collection.

    Returns:
        JSON response containing a list of image dictionaries with
        uuid and filename fields.
    """
    user = cast(User, request.user)
    if user.username == "service_user":
        # Called by the create_collection_thumbnail Lambda, which runs against
        # collections regardless of owner. Mirrors the BlobViewSet bypass.
        collection = get_object_or_404(Collection, uuid=collection_uuid)
    else:
        collection = get_user_object_or_404(user, Collection, uuid=collection_uuid)
    blob_list = collection.get_recent_images()

    return Response(
        [
            {
                "uuid": x["uuid"],
                "filename": x["file"]
            }
            for x in blob_list
        ]
    )


@api_view(["GET"])
def search(request: HttpRequest) -> Response:
    """Search for collections.

    Searches collections for the current user with optional filters by
    name, blob UUID, and exclusion of collections containing a blob.

    Args:
        request: The HTTP request containing optional query parameters:
            - query: Collection name to search for (case-insensitive)
            - blob_uuid: Filter collections containing this blob UUID
            - exclude_blob_uuid: Annotate whether collection contains this blob

    Returns:
        JSON response containing a list of collection dictionaries with
        name, uuid, num_objects, url, cover_url, and optionally contains_blob.
    """
    user = cast(User, request.user)
    query = Collection.objects.filter(user=user)

    query = query.annotate(num_objects=Count("collectionobject"))

    if "query" in request.GET:
        query = query.filter(name__icontains=request.GET["query"])

    if "blob_uuid" in request.GET:
        query = query.filter(collectionobject__blob__uuid__in=[request.GET.get("blob_uuid")])

    if "exclude_blob_uuid" in request.GET:
        contains_blob = Collection.objects.filter(uuid=OuterRef("uuid")) \
                                          .filter(collectionobject__blob__uuid__in=[request.GET.get("exclude_blob_uuid")])
        query = query.annotate(contains_blob=Exists(contains_blob))

    collection_list = query.order_by("-modified")

    return Response(
        [
            {
                "name": x.name,
                "uuid": x.uuid,
                "num_objects": x.num_objects,
                "url": reverse("collection:detail", kwargs={"uuid": x.uuid}),
                "cover_url": f"{settings.COVER_URL}collections/{x.uuid}.jpg",
                "contains_blob": getattr(x, "contains_blob", None)
            }
            for x in collection_list
        ]
    )


@api_view(["POST"])
@validate_post_data("collection_uuid")
def create_blob(request: HttpRequest) -> Response:
    """Create a new blob and add it to a collection.

    Creates a new blob from uploaded file contents, checks for duplicates
    by SHA1 hash, and adds it to the specified collection. Returns an error
    if a blob with the same SHA1 hash already exists.

    Args:
        request: The HTTP request containing:
            - collection_uuid: UUID of the collection to add the blob to
            - blob: The uploaded file

    Returns:
        JSON response containing:
            - status: "OK" on success, "Error" on failure
            - blob_uuid: UUID of the created blob (on success)
            - message: Error message with link to existing blob (on error)
    """
    collection_uuid = request.POST["collection_uuid"]
    uploaded_file = cast(UploadedFile, request.FILES["blob"])
    sha1sum = calculate_sha1sum(uploaded_file)
    file_contents = uploaded_file.read()

    user = cast(User, request.user)
    dupe_check = Blob.objects.filter(sha1sum=sha1sum, user=user)
    existing_blob = dupe_check.first()

    if existing_blob:

        return Response({
            "detail": "This blob already exists.",
            "existing_blob_uuid": str(existing_blob.uuid),
            "existing_blob_url": reverse("blob:detail", kwargs={"uuid": existing_blob.uuid}),
        }, status=400)

    else:

        with transaction.atomic():
            blob = Blob.objects.create(
                user=user,
                date=timezone.now().date().strftime("%Y-%m-%d")
            )

            blob.file_modified = int(timezone.now().timestamp())  # type: ignore[attr-defined]
            blob.file.save(uploaded_file.name, BytesIO(file_contents))
            blob.sha1sum = sha1sum
            blob.save()

            collection = get_user_object_or_404(user, Collection, uuid=collection_uuid)
            collection.add_object(blob)

        blob.index_blob()

        response = {
            "blob_uuid": str(blob.uuid)
        }

    return Response(response, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def get_object_list(request: HttpRequest, collection_uuid: str) -> Response:
    """Get a paginated list of objects in a collection.

    Retrieves objects from the specified collection with optional
    randomization and pagination.

    Args:
        request: The HTTP request containing:
            - pageNumber: Page number to retrieve (default: 1)
            - random_order: Whether to randomize object order (default: false)
            - tag: Optional tag name to filter objects
        collection_uuid: The UUID of the collection.

    Returns:
        JSON response containing paginated object list data.
    """
    user = cast(User, request.user)
    collection = get_user_object_or_404(user, Collection, uuid=collection_uuid)
    random_order = request.GET.get("random_order", "").lower() == "true"
    tag = request.GET.get("tag") or None
    try:
        page_number = int(request.GET.get("pageNumber", 1))
    except (ValueError, TypeError):
        return Response({"detail": "Invalid page number."}, status=400)

    object_list = collection.get_object_list(
        page_number=page_number,
        random_order=random_order,
        tag=tag
    )

    return Response(object_list)


@api_view(["POST"])
@validate_post_data("collection_uuid")
def add_object(request: HttpRequest) -> Response:
    """Add an object (blob or bookmark) to a collection.

    Adds a blob or bookmark to the specified collection. Returns an error
    if the object is already in the collection or if neither blob_uuid
    nor bookmark_uuid is provided.

    Args:
        request: The HTTP request containing:
            - collection_uuid: UUID of the collection
            - blob_uuid: UUID of the blob to add (optional)
            - bookmark_uuid: UUID of the bookmark to add (optional)

    Returns:
        JSON response containing:
            - status: "OK" on success, "Error" on failure
            - message: Error message if status is "Error"
    """
    collection_uuid = request.POST["collection_uuid"]
    blob_uuid = request.POST.get("blob_uuid", None)
    bookmark_uuid = request.POST.get("bookmark_uuid", None)

    user = cast(User, request.user)
    collection = get_user_object_or_404(user, Collection, uuid=collection_uuid)

    item: Blob | Bookmark
    if blob_uuid:
        item = get_user_object_or_404(user, Blob, uuid=blob_uuid)
    elif bookmark_uuid:
        item = get_user_object_or_404(user, Bookmark, uuid=bookmark_uuid)
    else:
        return Response(
            {
                "detail": "You must specify a blob_uuid or bookmark_uuid"
            },
            status=400
        )

    try:
        collection.add_object(item)
        response: dict[str, str] = {}
    except DuplicateObjectError:
        return Response({
            "detail": "That object already belongs to this collection."
        }, status=400)

    return Response(response, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@validate_post_data("collection_uuid", "object_uuid")
def remove_object(request: HttpRequest) -> Response:
    """Remove an object from a collection.

    Removes a blob or bookmark from the specified collection.

    Args:
        request: The HTTP request containing:
            - collection_uuid: UUID of the collection
            - object_uuid: UUID of the object to remove

    Returns:
        JSON response containing:
            - status: "OK"
    """
    collection_uuid = request.POST["collection_uuid"]
    object_uuid = request.POST["object_uuid"]

    user = cast(User, request.user)
    collection = get_user_object_or_404(user, Collection, uuid=collection_uuid)

    try:
        collection.remove_object(object_uuid)
    except CollectionObject.DoesNotExist:
        return Response(
            {"detail": "Object not found in this collection."},
            status=404
        )

    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@validate_post_data("collection_uuid", "object_uuid", "new_position")
def sort_objects(request: HttpRequest) -> Response:
    """Move an object to a new position in a collection.

    Reorders an object (blob or bookmark) to a new position in the
    sorted list of collection objects.

    Args:
        request: The HTTP request containing:
            - collection_uuid: UUID of the collection
            - object_uuid: UUID of the object to reorder
            - new_position: The new position index for the object

    Returns:
        JSON response containing:
            - status: "OK"
    """
    collection_uuid = request.POST["collection_uuid"]
    object_uuid = request.POST["object_uuid"]
    try:
        new_position = int(request.POST["new_position"])
    except (ValueError, TypeError):
        return Response({"detail": "Invalid position value."}, status=400)

    user = cast(User, request.user)
    so = get_object_or_404(
        CollectionObject,
        Q(blob__uuid=object_uuid) | Q(bookmark__uuid=object_uuid),
        collection__uuid=collection_uuid,
        collection__user=user,
    )
    CollectionObject.reorder(so, new_position)

    return Response()


@api_view(["POST"])
@validate_post_data("collection_uuid", "object_uuid", "note")
def update_object_note(request: HttpRequest) -> Response:
    """Update the note for an object in a collection.

    Updates the note field for a blob or bookmark in the specified collection.

    Args:
        request: The HTTP request containing:
            - collection_uuid: UUID of the collection
            - object_uuid: UUID of the object to update
            - note: The new note text

    Returns:
        JSON response containing:
            - status: "OK"
    """
    collection_uuid = request.POST["collection_uuid"]
    object_uuid = request.POST["object_uuid"]
    note = request.POST["note"]

    user = cast(User, request.user)
    so = get_object_or_404(
        CollectionObject,
        Q(blob__uuid=object_uuid) | Q(bookmark__uuid=object_uuid),
        collection__uuid=collection_uuid,
        collection__user=user,
    )
    so.note = note
    so.save()

    return Response()


@api_view(["POST"])
@validate_post_data("collection_uuid", "url")
def add_new_bookmark(request: HttpRequest) -> Response:
    """Add a new bookmark to a collection.

    Creates a new bookmark from a URL (or uses an existing one if found)
    and adds it to the specified collection. Returns an error if the
    bookmark is already in the collection.

    Args:
        request: The HTTP request containing:
            - collection_uuid: UUID of the collection
            - url: URL of the bookmark to create/add

    Returns:
        JSON response containing:
            - status: "OK" on success, "Error" on failure
            - message: Error message if status is "Error"
    """
    collection_uuid = request.POST["collection_uuid"]
    url = request.POST["url"]

    user = cast(User, request.user)
    bookmark = None
    try:
        bookmark = Bookmark.objects.get(user=user, url=url)
    except ObjectDoesNotExist:
        pass

    if not bookmark:
        title = parse_title_from_url(url)[1]

        bookmark = Bookmark.objects.create(
            user=user,
            name=title,
            url=url
        )
        bookmark.index_bookmark()

    collection = get_user_object_or_404(user, Collection, uuid=collection_uuid)

    if CollectionObject.objects.filter(
            collection=collection,
            bookmark=bookmark
    ).exists():
        return Response({
            "detail": "This bookmark is already a member of the collection."
        }, status=400)

    collection.add_object(bookmark)
    return Response(status=status.HTTP_201_CREATED)
