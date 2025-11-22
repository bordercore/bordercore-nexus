"""Views for the collection application.

This module contains views for managing collections, collection objects,
and related operations in the collection system.
"""
import hashlib
from io import BytesIO
from typing import Any, cast

from rest_framework.decorators import api_view

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.core.files.uploadedfile import UploadedFile
from django.db.models import Count, Exists, OuterRef, Q, QuerySet
from django.forms import BaseModelForm
from django.forms.models import model_to_dict
from django.http import (HttpRequest, HttpResponse, HttpResponseRedirect,
                         JsonResponse)
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.http import require_POST
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
from lib.mixins import FormRequestMixin
from lib.util import calculate_sha1sum, parse_title_from_url
from tag.models import Tag


@method_decorator(login_required, name="dispatch")
class CollectionListView(FormRequestMixin, FormMixin, ListView):
    """View for displaying the collection list page.

    Shows favorite collections for the current user with their blob counts
    and cover images. Supports filtering by collection name.
    """

    form_class = CollectionForm

    def get_queryset(self) -> QuerySet[Collection]:
        """Get the queryset of favorite collections for the current user.

        Filters collections to only show favorites, optionally filters by
        name if a query parameter is provided, and annotates with blob counts.

        Returns:
            QuerySet of Collection objects filtered to favorites, ordered by
            modification date (newest first).
        """
        user = cast(User, self.request.user)
        query = Collection.objects.filter(
            user=user,
            is_favorite=True
        )

        if "query" in self.request.GET:
            query = query.filter(name__icontains=self.request.GET["query"])

        query = query.annotate(num_blobs=Count("collectionobject"))

        query = query.order_by("-modified")

        return query

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the collection list view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - collection_list: List of collection dictionaries with uuid,
                  name, url, num_blobs, and cover_url
                - cover_url: Base URL for collection cover images
                - title: Page title
        """
        context = super().get_context_data(**kwargs)

        context["collection_list"] = [
            {
                "uuid": c.uuid,
                "name": c.name,
                "url": reverse("collection:detail", kwargs={"uuid": c.uuid}),
                "num_blobs": c.num_blobs,
                "cover_url": c.cover_url,
            } for c in self.object_list

        ]
        context["cover_url"] = settings.COVER_URL
        context["title"] = "Collection List"

        return context


@method_decorator(login_required, name="dispatch")
class CollectionDetailView(FormRequestMixin, FormMixin, DetailView):
    """View for displaying a collection detail page.

    Shows a single collection with its tags, object tags with counts,
    and collection metadata.
    """

    model = Collection
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    form_class = CollectionForm

    def get_queryset(self) -> QuerySet[Collection]:
        """Get the queryset of collections for the current user.

        Returns:
            QuerySet of Collection objects filtered by user.
        """
        user = cast(User, self.request.user)
        return Collection.objects.filter(user=user)

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the collection detail view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - tags: List of tag names associated with the collection
                - object_tags: List of tags used by objects in the collection
                  with their blob counts
                - collection_json: Dictionary representation of the collection
                  with name and description fields
                - title: Page title
        """
        context = super().get_context_data(**kwargs)

        context["tags"] = list(self.object.tags.values_list("name", flat=True))

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
        context["collection_json"] = model_to_dict(self.object, fields=["name", "description"])
        context["title"] = f"Collection Detail :: {self.object.name}"

        return context


@method_decorator(login_required, name="dispatch")
class CollectionCreateView(FormRequestMixin, CreateView):
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


@method_decorator(login_required, name="dispatch")
class CollectionUpdateView(FormRequestMixin, UpdateView):
    """View for updating an existing collection.

    Handles editing of collections, including updating tags.
    Filters collections to only show those owned by the logged-in user.
    """

    model = Collection
    form_class = CollectionForm
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def get_queryset(self) -> QuerySet[Collection]:
        """Get the queryset filtered to the current user's collections.

        Returns:
            Collections owned by the logged-in user.
        """
        base_qs = super().get_queryset()
        user = cast(User, self.request.user)
        return base_qs.filter(user=user)

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


@method_decorator(login_required, name="dispatch")
class CollectionDeleteView(DeleteView):
    """View for deleting a collection.

    Allows users to delete their own collections. Filters collections to
    only show those owned by the logged-in user.
    """

    model = Collection
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    success_url = reverse_lazy("collection:list")

    def get_queryset(self) -> QuerySet[Collection]:
        """Get the queryset filtered to the current user's collections.

        Returns:
            Collections owned by the logged-in user.
        """
        # Filter the queryset to only include objects owned by the logged-in user
        user = cast(User, self.request.user)
        return self.model.objects.filter(user=user)

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
            f"Collection <strong>{self.object.name}</strong> deleted"
        )
        return super().form_valid(form)


@login_required
def get_blob(request: HttpRequest, collection_uuid: str) -> JsonResponse:
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
    collection = Collection.objects.get(uuid=collection_uuid, user=user)
    direction = request.GET.get("direction", "next")
    blob_position = int(request.GET.get("position", 0))
    tag_name = request.GET.get("tag", None)
    randomize = request.GET.get("randomize", "") == "true"

    return JsonResponse(collection.get_blob(blob_position, direction, randomize, tag_name))


@api_view(["GET"])
def get_images(request: HttpRequest, collection_uuid: str) -> JsonResponse:
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
    # Note: This is an API view that may be called by AWS Lambda, so user filtering may not apply
    # However, collections should still be user-scoped for security
    blob_list = Collection.objects.get(uuid=str(collection_uuid)).get_recent_images()

    return JsonResponse(
        [
            {
                "uuid": x["uuid"],
                "filename": x["file"]
            }
            for x in blob_list
        ],
        safe=False
    )


@login_required
def search(request: HttpRequest) -> JsonResponse:
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

    return JsonResponse(
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
        ],
        safe=False
    )


@login_required
@require_POST
@validate_post_data("collection_uuid")
def create_blob(request: HttpRequest) -> JsonResponse:
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

        blob_url = reverse("blob:detail", kwargs={"uuid": existing_blob.uuid})
        response = {
            "status": "Error",
            "message": f"This blob <a href='{blob_url}'>already exists</a>."
        }

    else:

        blob = Blob.objects.create(
            user=user,
            date=timezone.now().date().strftime("%Y-%m-%d")
        )

        blob.file_modified = str(int(timezone.now().timestamp()))  # type: ignore[attr-defined]
        blob.file.save(uploaded_file.name, BytesIO(file_contents))
        blob.sha1sum = sha1sum
        blob.save()

        blob.index_blob()

        collection = Collection.objects.get(uuid=collection_uuid, user=user)
        collection.add_object(blob)

        response = {
            "status": "OK",
            "blob_uuid": str(blob.uuid)
        }

    return JsonResponse(response)


@login_required
def get_object_list(request: HttpRequest, collection_uuid: str) -> JsonResponse:
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
    collection = Collection.objects.get(uuid=collection_uuid, user=user)
    random_order = request.GET.get("random_order", "").lower() == "true"
    tag = request.GET.get("tag") or None
    page_number = int(request.GET.get("pageNumber", 1))

    object_list = collection.get_object_list(
        page_number=page_number,
        random_order=random_order,
        tag=tag
    )

    return JsonResponse(object_list, safe=False)


@login_required
@require_POST
@validate_post_data("collection_uuid")
def add_object(request: HttpRequest) -> JsonResponse:
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
    collection = Collection.objects.get(uuid=collection_uuid, user=user)

    item: Blob | Bookmark
    if blob_uuid:
        item = Blob.objects.get(uuid=blob_uuid, user=user)
    elif bookmark_uuid:
        item = Bookmark.objects.get(uuid=bookmark_uuid, user=user)
    else:
        return JsonResponse(
            {
                "status": "Error",
                "message": "You must specify a blob_uuid or bookmark_uuid"
            }
        )

    try:
        collection.add_object(item)
        response = {
            "status": "OK",
        }
    except DuplicateObjectError:
        response = {
            "status": "Error",
            "message": "That object already belongs to this collection."
        }

    return JsonResponse(response)


@login_required
@require_POST
@validate_post_data("collection_uuid", "object_uuid")
def remove_object(request: HttpRequest) -> JsonResponse:
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
    collection = Collection.objects.get(uuid=collection_uuid, user=user)
    collection.remove_object(object_uuid)

    response = {
        "status": "OK",
    }

    return JsonResponse(response)


@login_required
@require_POST
@validate_post_data("collection_uuid", "object_uuid", "new_position")
def sort_objects(request: HttpRequest) -> JsonResponse:
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
    new_position = int(request.POST["new_position"])

    user = cast(User, request.user)
    so = CollectionObject.objects.get(
        Q(blob__uuid=object_uuid) | Q(bookmark__uuid=object_uuid),
        collection__uuid=collection_uuid,
        collection__user=user
    )
    CollectionObject.reorder(so, new_position)

    response = {
        "status": "OK",
    }

    return JsonResponse(response)


@login_required
@require_POST
@validate_post_data("collection_uuid", "object_uuid", "note")
def update_object_note(request: HttpRequest) -> JsonResponse:
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
    so = CollectionObject.objects.get(
        Q(blob__uuid=object_uuid) | Q(bookmark__uuid=object_uuid),
        collection__uuid=collection_uuid,
        collection__user=user
    )
    so.note = note
    so.save()

    response = {
        "status": "OK",
    }

    return JsonResponse(response)


@login_required
@require_POST
@validate_post_data("collection_uuid", "url")
def add_new_bookmark(request: HttpRequest) -> JsonResponse:
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

    collection = Collection.objects.get(uuid=collection_uuid, user=user)

    if CollectionObject.objects.filter(
            collection=collection,
            bookmark=bookmark
    ).exists():
        response = {
            "status": "Error",
            "message": "This bookmark is already a member of the collection."
        }
    else:
        collection.add_object(bookmark)
        response = {
            "status": "OK"
        }

    return JsonResponse(response)
