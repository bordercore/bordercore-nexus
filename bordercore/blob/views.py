"""Views for the blob application.

This module contains views for managing blobs (files/documents), including
creation, editing, viewing, importing, and managing relationships between
blobs and other objects like collections and nodes.
"""
import json
import logging
from typing import Any, Generator, cast

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.core.files.uploadedfile import UploadedFile
from django.db.models import Count, Q, QuerySet
from django.db.models.functions import Lower
from django.forms import BaseModelForm
from django.http import (HttpRequest, HttpResponse, HttpResponseRedirect,
                         JsonResponse, StreamingHttpResponse)
from django.shortcuts import render
from django.urls import reverse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.http import require_POST
from django.views.generic.base import View
from django.views.generic.detail import DetailView
from django.views.generic.edit import CreateView, ModelFormMixin, UpdateView
from django.views.generic.list import ListView

from blob.forms import BlobForm
from blob.models import (Blob, BlobTemplate, BlobToObject, MetaData,
                         RecentlyViewedBlob)
from blob.services import add_related_object as add_related_object_service
from blob.services import chatbot, get_books, import_blob
from collection.models import Collection, CollectionObject
from lib.decorators import validate_post_data
from lib.exceptions import (InvalidNodeTypeError, NodeNotFoundError,
                            ObjectAlreadyRelatedError,
                            RelatedObjectNotFoundError,
                            UnsupportedNodeTypeError)
from lib.mixins import FormRequestMixin
from lib.time_utils import parse_date_from_string

log = logging.getLogger(f"bordercore.{__name__}")


class FormValidMixin(ModelFormMixin):
    """A mixin to encapsulate common logic used in Update and Create views.

    Handles form validation, blob saving, metadata management, and relationship
    creation for both blob creation and update operations.
    """

    object: Blob | None  # Provided by SingleObjectMixin
    request: HttpRequest  # Provided by View

    def form_valid(self, form: BaseModelForm) -> JsonResponse:
        """Handle a valid form submission.

        Saves the blob, handles file renaming, metadata, linked objects,
        and collections. Indexes the blob in Elasticsearch after saving.

        Args:
            form: The validated blob form.

        Returns:
            JSON response with status and blob UUID.
        """
        new_object = not self.object

        blob = form.save(commit=False)

        # Only rename a blob's file if the file itself hasn't changed
        if "file" not in form.changed_data and form.cleaned_data["filename"] != blob.file.name:
            blob.rename_file(form.cleaned_data["filename"])

        user = cast(User, self.request.user)
        blob.user = user
        blob.file.name = form.cleaned_data["filename"]
        blob.file_modified = form.cleaned_data["file_modified"]
        blob.save()

        # Save the tags
        form.save_m2m()

        handle_metadata(blob, self.request)

        if new_object:
            if "linked_blob_uuid" in self.request.POST:
                linked_blob = Blob.objects.get(uuid=self.request.POST["linked_blob_uuid"], user=user)
                BlobToObject.objects.create(node=linked_blob, blob=blob)

            handle_linked_collection(blob, self.request)

            if "collection_uuid" in self.request.POST:
                collection = Collection.objects.get(uuid=self.request.POST["collection_uuid"], user=user)
                collection.add_object(blob)

        blob.index_blob()

        message = "Blob created" if new_object else "Blob updated"
        messages.add_message(self.request, messages.INFO, message)

        return JsonResponse({"status": "OK", "uuid": blob.uuid})

    def form_invalid(self, form: BaseModelForm) -> JsonResponse:
        """Handle an invalid form submission.

        Args:
            form: The invalid form.

        Returns:
            JSON response with form errors and 400 status code.
        """
        return JsonResponse(form.errors, status=400)


@method_decorator(login_required, name="dispatch")
class BlobListView(ListView):
    """View for displaying the blob list page.

    Shows a list of recent blobs for the logged-in user.
    """

    model = Blob

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the blob list view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - title: Page title "Recent Blobs"
        """
        context = super().get_context_data(**kwargs)

        return {
            **context,
            "title": "Recent Blobs"
        }


@method_decorator(login_required, name="dispatch")
class BlobCreateView(FormRequestMixin, CreateView, FormValidMixin):
    """View for creating a new blob.

    Handles the creation of new blobs, including pre-populating form fields
    from linked blobs or collections, and managing templates.
    """

    template_name = "blob/update.html"
    form_class = BlobForm

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the blob creation form.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - action: "New" to indicate creation mode
                - title: Page title "Create Blob"
                - linked_blob: Information about a linked blob if provided
                - linked_collection: Linked collection if provided
                - metadata: List of metadata items
                - tags: List of tag names
                - collection_info: Collection information if provided
                - template_list: List of available blob templates
        """
        context = super().get_context_data(**kwargs)
        context["action"] = "New"

        user = cast(User, self.request.user)

        if "linked_blob_uuid" in self.request.GET:
            linked_blob = Blob.objects.get(user=user, uuid=self.request.GET["linked_blob_uuid"])
            context["linked_blob"] = {
                "name": linked_blob.name,
                "thumbnail_url": linked_blob.cover_url_small,
                "uuid": linked_blob.uuid
            }
            # Grab the initial metadata and tags from the linked blob
            context["metadata"] = list(linked_blob.metadata.all().values())
            context["tags"] = [x["name"] for x in linked_blob.tags.all().values()]

        if "linked_collection" in self.request.GET:
            context["linked_collection"] = Collection.objects.get(
                user=user,
                uuid=self.request.GET["linked_collection"]
            )
            collection_object = CollectionObject.objects.filter(
                collection__user=user,
                collection__uuid=self.request.GET["linked_collection"]
            ).first()
            if collection_object and collection_object.blob:
                context["tags"] = [
                    x.name
                    for x in collection_object.blob.tags.all()
                ]
            else:
                context["tags"] = []

        if "metadata" not in context:
            context["metadata"] = []

        if "collection_uuid" in self.request.GET:
            context["collection_info"] = Collection.objects.get(user=user, uuid=self.request.GET["collection_uuid"])

        context["template_list"] = [
            {
                "uuid": x.uuid,
                "name": x.name,
                "template": x.template,
            } for x in
            BlobTemplate.objects.filter(user=user)
        ]
        context["title"] = "Create Blob"

        return context

    def get_form(self, form_class: type[BaseModelForm] | None = None) -> BaseModelForm:
        """Get the form instance with initial data populated.

        Pre-populates form fields based on query parameters like is_note,
        linked_blob, or linked_collection.

        Args:
            form_class: Optional form class to use.

        Returns:
            Form instance with initial data populated.
        """
        form = super().get_form(form_class)

        if "is_note" in self.request.GET:
            form.initial["is_note"] = True
            form.initial["math_support"] = True

        user = cast(User, self.request.user)

        if "linked_blob" in self.request.GET:
            blob = Blob.objects.get(user=user, pk=int(self.request.GET["linked_blob"]))
            form.initial["tags"] = ",".join([x.name for x in blob.tags.all()])
            form.initial["date"] = blob.date
            form.initial["name"] = blob.name

        if "linked_collection" in self.request.GET:
            collection_uuid = self.request.GET["linked_collection"]
            co = CollectionObject.objects.filter(collection__uuid=collection_uuid, collection__user=user).first()
            if co and co.blob:
                form.initial["date"] = co.blob.date
                form.initial["name"] = co.blob.name

        return form


@method_decorator(login_required, name="dispatch")
class BlobDetailView(DetailView):
    """View for displaying a blob detail page.

    Shows a single blob with its metadata, relationships, collections,
    nodes, and Elasticsearch information.
    """

    model = Blob
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the blob detail view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - metadata: Dictionary of metadata key-value pairs
                - urls: List of URLs associated with the blob
                - metadata_misc: Miscellaneous metadata (excluding common fields)
                - date: Formatted date string
                - aws_url: AWS S3 console URL if blob has sha1sum
                - is_pinned_note: Whether the note is pinned (if is_note)
                - elasticsearch_info: Elasticsearch document info
                - back_references: List of blobs that reference this blob
                - collection_list: List of collections containing this blob
                - node_list: List of nodes containing this blob
                - title: Blob name/title
                - show_metadata: Boolean indicating if metadata should be shown
                - tree: Tree structure of related blobs
                - name: Blob name without edition string
        """
        context = super().get_context_data(**kwargs)

        user = cast(User, self.request.user)
        RecentlyViewedBlob.add(user, blob=self.object)

        context["metadata"], context["urls"] = self.object.get_metadata()

        context["metadata_misc"] = {
            key: value for (key, value)
            in context["metadata"].items()
            if key not in
            [
                "is_book",
                "Url",
                "Publication Date",
                "Subtitle",
                "Name",
                "Author"
            ]
        }

        context["date"] = self.object.parsed_date

        if self.object.sha1sum:
            context["aws_url"] = f"https://s3.console.aws.amazon.com/s3/buckets/{settings.AWS_STORAGE_BUCKET_NAME}/blobs/{self.object.uuid}/"

        if self.object.is_note:
            context["is_pinned_note"] = self.object.is_pinned_note

        try:
            context["elasticsearch_info"] = self.object.get_elasticsearch_info()
        except IndexError:
            # Give Elasticsearch up to a minute to index the blob
            if int(timezone.now().timestamp()) - int(self.object.created.timestamp()) > 60:
                messages.add_message(self.request, messages.ERROR, "Blob not found in Elasticsearch")
        except Exception as e:
            log.warning("Failed to fetch ES info for blob %s: %s", self.object.uuid, e, exc_info=True)
            context["elasticsearch_info"] = None

        context["back_references"] = Blob.back_references(self.object.uuid)
        context["collection_list"] = self.object.collections
        context["node_list"] = self.object.get_nodes()
        context["title"] = self.object

        context["show_metadata"] = "content_type" in context \
            or self.object.sha1sum \
            or context["metadata_misc"] != {}

        context["tree"] = {
            "label": "Root",
            "nodes": self.object.get_tree()
        }

        context["name"] = self.object.get_name(remove_edition_string=True)

        return context

    def get_queryset(self) -> QuerySet[Blob]:
        """Get the queryset filtered to the current user's blobs.

        Returns:
            Blobs owned by the logged-in user.
        """
        user = cast(User, self.request.user)
        return Blob.objects.filter(user=user)


@method_decorator(login_required, name="dispatch")
class BlobUpdateView(FormRequestMixin, UpdateView, FormValidMixin):
    """View for updating an existing blob.

    Handles editing of blobs, including updating metadata, tags, and
    collection associations.
    """

    model = Blob
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    template_name = "blob/update.html"
    form_class = BlobForm

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the blob edit form.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - sha1sum: SHA1 hash of the blob file if present
                - cover_url: URL of the blob's cover image
                - metadata: List of metadata items (excluding is_book)
                - is_book: Boolean indicating if blob is a book
                - collections_other: Other favorite collections not containing this blob
                - date_format: Date format string ("year" or "standard")
                - action: "Edit" to indicate edit mode
                - title: Blob name without edition string
                - tags: List of current tag names
        """
        context = super().get_context_data(**kwargs)
        context["sha1sum"] = self.kwargs.get("sha1sum")

        if self.object.sha1sum:
            context["cover_url"] = self.object.get_cover_url()

        context["metadata"] = list(self.object.metadata.exclude(name="is_book").values())
        context["is_book"] = self.object.metadata.filter(name="is_book").exists()
        user = cast(User, self.request.user)
        context["collections_other"] = Collection.objects.filter(
            Q(user=user)
            & ~Q(collectionobject__blob__uuid=self.object.uuid)
            & Q(is_favorite=True)
        )
        context["date_format"] = "year" if self.object.date_is_year else "standard"
        context["action"] = "Edit"
        context["title"] = self.object.get_name(remove_edition_string=True)
        context["tags"] = [x.name for x in self.object.tags.all()]

        return context


@method_decorator(login_required, name="dispatch")
class BlobCloneView(View):
    """View for cloning an existing blob.

    Creates a copy of a blob and redirects to the new blob's detail page.
    """

    def get(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponseRedirect:
        """Handle GET requests to clone a blob.

        Args:
            request: The HTTP request.
            *args: Additional positional arguments.
            **kwargs: Additional keyword arguments containing:
                - uuid: UUID of the blob to clone

        Returns:
            Redirect to the cloned blob's detail page.
        """
        user = cast(User, request.user)
        original_blob = Blob.objects.get(uuid=kwargs["uuid"], user=user)
        new_blob = original_blob.clone()
        messages.add_message(request, messages.INFO, "New blob successfully cloned")
        return HttpResponseRedirect(reverse("blob:detail", kwargs={"uuid": new_blob.uuid}))


@method_decorator(login_required, name="dispatch")
class BlobImportView(View):
    """View for importing a blob from a URL.

    Handles importing blobs from external URLs and creating new blob
    instances from them.
    """

    template_name = "blob/import.html"

    def get(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        """Handle GET requests to show the import form.

        Args:
            request: The HTTP request.
            *args: Additional positional arguments.
            **kwargs: Additional keyword arguments.

        Returns:
            Rendered import template.
        """
        return render(request, self.template_name, {})

    def post(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse | HttpResponseRedirect:
        """Handle POST requests to import a blob from a URL.

        Args:
            request: The HTTP request containing:
                - url: URL to import from
            *args: Additional positional arguments.
            **kwargs: Additional keyword arguments.

        Returns:
            Redirect to the imported blob's detail page on success,
            or render import template with errors on failure.
        """
        url = request.POST.get("url", None)

        user = cast(User, request.user)
        blob: Blob | None = None
        if not url:
            messages.add_message(request, messages.ERROR, "URL is required.")
        else:
            try:
                blob = import_blob(user, url)
            except Exception as e:
                messages.add_message(request, messages.ERROR, str(e))

        if blob:
            return HttpResponseRedirect(reverse("blob:detail", kwargs={"uuid": blob.uuid}))
        return render(request, self.template_name, {})


def handle_metadata(blob: Blob, request: HttpRequest) -> None:
    """Handle metadata objects separately from the form.

    Deletes existing metadata and creates new metadata entries based on
    POST data. Also handles the is_book flag.

    Args:
        blob: The blob instance to update metadata for.
        request: The HTTP request containing metadata in POST data.
    """
    blob.metadata.all().delete()

    user = cast(User, request.user)

    if "metadata" in request.POST:
        for pair in json.loads(request.POST["metadata"]):
            new_metadata, created = MetaData.objects.get_or_create(
                blob=blob,
                user=user,
                name=pair["name"],
                value=pair["value"]
            )
            if created:
                new_metadata.save()

    if request.POST.get("is_book", ""):
        new_metadata = MetaData(user=user, name="is_book", value="true", blob=blob)
        new_metadata.save()


def handle_linked_collection(blob: Blob, request: HttpRequest) -> None:
    """Handle adding a blob to a linked collection.

    If a linked_collection UUID is provided in POST data, adds the blob
    to that collection.

    Args:
        blob: The blob instance to add to a collection.
        request: The HTTP request containing linked_collection in POST data.
    """
    if "linked_collection" in request.POST:
        user = cast(User, request.user)
        collection = Collection.objects.get(user=user, uuid=request.POST["linked_collection"])
        collection.add_object(blob)


@login_required
def metadata_name_search(request: HttpRequest) -> JsonResponse:
    """Search for metadata names matching a query.

    Returns a list of distinct metadata names that contain the query string,
    formatted for autocomplete use.

    Args:
        request: The HTTP request containing:
            - query: Search query string

    Returns:
        JSON response with list of matching metadata names.
    """
    user = cast(User, request.user)
    m = MetaData.objects.filter(
        user=user
    ).values(
        "name"
    ).filter(
        name__icontains=request.GET["query"]
    ).distinct(
        "name"
    ).order_by(
        "name"
    )
    return_data = [{"label": x["name"]} for x in m]
    return JsonResponse(return_data, safe=False)


@login_required
def parse_date(request: HttpRequest, input_date: str) -> JsonResponse:
    """Parse a date string and return formatted output.

    Attempts to parse the input date string and returns either a formatted
    date or an error message.

    Args:
        request: The HTTP request.
        input_date: Date string to parse.

    Returns:
        JSON response containing:
            - output_date: Parsed and formatted date string, or empty string on error
            - error: Error message if parsing failed, or None on success
    """
    error = None
    response = ""

    try:
        response = parse_date_from_string(input_date)
    except ValueError as e:
        error = str(e)

    return JsonResponse({"output_date": response,
                         "error": error})


@login_required
@require_POST
@validate_post_data("blob_uuid")
def update_cover_image(request: HttpRequest) -> JsonResponse:
    """Update the blob's cover image.

    Updates the cover image for a blob from uploaded image data.

    Args:
        request: The HTTP request containing:
            - blob_uuid: UUID of the blob to update
            - image: Image file to use as cover

    Returns:
        JSON response with status.
    """
    blob_uuid = request.POST["blob_uuid"]
    image_file = cast(UploadedFile, request.FILES["image"])
    image = image_file.read()

    user = cast(User, request.user)
    blob = Blob.objects.get(uuid=blob_uuid, user=user)
    blob.update_cover_image(image)

    response = {
        "status": "OK"
    }

    return JsonResponse(response)


@login_required
def get_elasticsearch_info(request: HttpRequest, uuid: str) -> JsonResponse:
    """Get the Elasticsearch entry for a blob.

    Retrieves Elasticsearch document information for a blob. Returns an
    empty dict if the blob is not found in Elasticsearch.

    Args:
        request: The HTTP request.
        uuid: UUID of the blob to get Elasticsearch info for.

    Returns:
        JSON response containing:
            - info: Elasticsearch document information, or empty dict if not found
            - status: "OK"
    """
    user = cast(User, request.user)
    blob = Blob.objects.get(uuid=uuid, user=user)

    try:
        info = blob.get_elasticsearch_info()
    except IndexError:
        info = {}

    response = {
        "info": info,
        "status": "OK"
    }

    return JsonResponse(response, safe=False)


@login_required
def get_related_objects(request: HttpRequest, uuid: str) -> JsonResponse:
    """Get all related objects to a given blob.

    Retrieves all objects (blobs, bookmarks, etc.) that are related
    to the specified blob.

    Args:
        request: The HTTP request.
        uuid: UUID of the blob to get related objects for.

    Returns:
        JSON response containing:
            - status: "OK"
            - related_objects: List of related objects
    """
    user = cast(User, request.user)
    blob = Blob.objects.get(user=user, uuid=uuid)

    response = {
        "status": "OK",
        "related_objects": Blob.related_objects("blob", "BlobToObject", blob),
    }

    return JsonResponse(response)


@login_required
@require_POST
@validate_post_data("node_uuid", "object_uuid")
def add_related_object(request: HttpRequest) -> JsonResponse:
    """Link a node (Blob or Question) to a Blob or Bookmark by its UUID.

    Called during new question creation, not during question update.

    Args:
        request: The HTTP request containing:
            - node_type: Type of the node ("blob" or "drill"). Defaults to "blob".
            - node_uuid: UUID of the node to which the object should be related.
            - object_uuid: UUID of the Blob or Bookmark to be related.

    Returns:
        JSON response with a "status" key (and an optional "message" if there's an error).
    """
    node_type = request.POST.get("node_type", "blob")
    node_uuid = request.POST["node_uuid"]
    object_uuid = request.POST["object_uuid"]

    try:
        result = add_related_object_service(node_type, node_uuid, object_uuid)
        return JsonResponse(result, status=200)
    except UnsupportedNodeTypeError as e:
        return JsonResponse({"status": "Error", "message": str(e)}, status=400)
    except InvalidNodeTypeError as e:
        return JsonResponse({"status": "Error", "message": str(e)}, status=400)
    except NodeNotFoundError as e:
        return JsonResponse({"status": "Error", "message": str(e)}, status=404)
    except RelatedObjectNotFoundError as e:
        return JsonResponse({"status": "Error", "message": str(e)}, status=400)
    except ObjectAlreadyRelatedError as e:
        return JsonResponse({"status": "Error", "message": str(e)}, status=400)


@login_required
@require_POST
@validate_post_data("node_uuid", "object_uuid")
def remove_related_object(request: HttpRequest) -> JsonResponse:
    """Remove a relationship between a node and another object.

    Deletes the relationship between a node (Blob or Question) and a
    related object (Blob or Bookmark).

    Args:
        request: The HTTP request containing:
            - node_type: Type of the node ("blob" or "drill"). Defaults to "blob".
            - node_uuid: UUID of the node
            - object_uuid: UUID of the object to remove relationship from

    Returns:
        JSON response with status.
    """
    node_uuid = request.POST["node_uuid"]
    object_uuid = request.POST["object_uuid"]
    node_type = request.POST.get("node_type", "blob")

    user = cast(User, request.user)
    node_model = Blob.get_node_model(node_type)

    cast(Any, node_model).objects.get(
        Q(node__uuid=node_uuid, node__user=user)
        & (
            Q(blob__uuid=object_uuid, blob__user=user) | Q(bookmark__uuid=object_uuid, bookmark__user=user)
        )
    ).delete()

    response = {
        "status": "OK",
    }

    return JsonResponse(response)


@login_required
@require_POST
@validate_post_data("node_uuid", "object_uuid", "new_position")
def sort_related_objects(request: HttpRequest) -> JsonResponse:
    """Change the sort order of a node and a related object.

    Updates the position of a related object within a node's list of
    related objects.

    Args:
        request: The HTTP request containing:
            - node_type: Type of the node ("blob" or "drill"). Defaults to "blob".
            - node_uuid: UUID of the node
            - object_uuid: UUID of the object to reorder
            - new_position: New position index for the object

    Returns:
        JSON response with status.
    """
    node_uuid = request.POST["node_uuid"]
    object_uuid = request.POST["object_uuid"]
    new_position = int(request.POST["new_position"])
    node_type = request.POST.get("node_type", "blob")

    user = cast(User, request.user)
    node_model = Blob.get_node_model(node_type)

    node_to_object = cast(Any, node_model).objects.get(
        Q(node__uuid=node_uuid, node__user=user)
        & (
            Q(blob__uuid=object_uuid, blob__user=user) | Q(bookmark__uuid=object_uuid, bookmark__user=user)
        )
    )
    cast(Any, node_model).reorder(node_to_object, new_position)

    response = {
        "status": "OK",
    }

    return JsonResponse(response)


@login_required
@require_POST
@validate_post_data("node_uuid", "object_uuid", "note")
def update_related_object_note(request: HttpRequest) -> JsonResponse:
    """Update the note for a related object.

    Updates the note field on a relationship between a node and a
    related object.

    Args:
        request: The HTTP request containing:
            - node_type: Type of the node ("blob" or "drill"). Defaults to "blob".
            - node_uuid: UUID of the node
            - object_uuid: UUID of the object
            - note: Note text to update

    Returns:
        JSON response with status.
    """
    node_uuid = request.POST["node_uuid"]
    object_uuid = request.POST["object_uuid"]
    note = request.POST["note"]
    node_type = request.POST.get("node_type", "blob")

    user = cast(User, request.user)
    node_model = Blob.get_node_model(node_type)

    node_to_object = cast(Any, node_model).objects.get(
        Q(node__uuid=node_uuid, node__user=user)
        & (
            Q(blob__uuid=object_uuid, blob__user=user) | Q(bookmark__uuid=object_uuid, bookmark__user=user)
        )
    )
    node_to_object.note = note
    node_to_object.save()

    response = {
        "status": "OK",
    }

    return JsonResponse(response)


@login_required
@require_POST
@validate_post_data("blob_uuid", "page_number")
def update_page_number(request: HttpRequest) -> JsonResponse:
    """Update the page number for a PDF that represents its cover image.

    Sets the page number of a PDF blob to use as its cover image.

    Args:
        request: The HTTP request containing:
            - blob_uuid: UUID of the blob to update
            - page_number: Page number to use as cover image

    Returns:
        JSON response with status and message.
    """
    blob_uuid = request.POST["blob_uuid"]
    page_number = int(request.POST["page_number"])

    user = cast(User, request.user)
    blob = Blob.objects.get(uuid=blob_uuid, user=user)
    blob.update_page_number(page_number)

    response = {
        "message": "Cover image will be updated soon",
        "status": "OK"
    }

    return JsonResponse(response)


@login_required
def get_template(request: HttpRequest) -> JsonResponse:
    """Get a blob template by UUID.

    Retrieves a blob template for the current user and returns its
    template content.

    Args:
        request: The HTTP request containing:
            - uuid: UUID of the template to retrieve

    Returns:
        JSON response containing:
            - template: Template content string
            - status: "OK"
        Or error response if template not found.
    """
    template_uuid = request.GET["uuid"]
    user = cast(User, request.user)
    blob_template = BlobTemplate.objects.filter(uuid=template_uuid, user=user).first()

    if not blob_template:
        return JsonResponse({
            "error": "Template not found"
        })

    response = {
        "template": blob_template.template,
        "status": "OK"
    }

    return JsonResponse(response)


@login_required
@require_POST
def chat(request: HttpRequest) -> StreamingHttpResponse:
    """Handle chat requests for blob-related queries.

    Processes chat requests using the chatbot service and streams
    responses back to the client.

    Args:
        request: The HTTP request containing chat POST data.

    Returns:
        Streaming HTTP response with chat content.
    """
    user = cast(User, request.user)
    try:
        content_iterator: Generator[str, None, None] = chatbot(request, request.POST)
    except Exception as e:
        log.error("Chat service failed for user %s: %s", user.id, e, exc_info=True)
        def error_generator() -> Generator[str, None, None]:
            yield f"An error occurred: {e}"
        content_iterator = error_generator()

    return StreamingHttpResponse(content_iterator, content_type="text/plain")


@method_decorator(login_required, name="dispatch")
class BookshelfListView(ListView):
    """View for displaying the bookshelf page.

    Shows a list of books (blobs with is_book metadata) with filtering
    by tag and search functionality.
    """

    template_name = "blob/bookshelf.html"

    def get_queryset(self) -> Any:
        """Get the queryset of books for the bookshelf.

        Retrieves books from Elasticsearch with optional tag and search
        filtering. Also builds a tag list with counts.

        Returns:
            List of dictionaries containing book information:
                - cover_url: URL of the book cover image
                - date: Publication date
                - name: Book name
                - tags: List of tag names
                - url: URL to book detail page
                - uuid: Book UUID
        """
        user = cast(User, self.request.user)
        book_list = get_books(
            user,
            self.request.GET.get("tag", None),
            self.request.GET.get("search", None)
        )

        self.tag_list = [
            {
                "name": hit["tags__name"],
                "count": hit["tag_count"]
            }
            for hit in
            Blob.objects.filter(
                user=user,
                metadata__name="is_book"
            ).values(
                "tags__name"
            ).annotate(
                tag_count=Count("tags__name")
            ).order_by(
                "-tag_count"
            )
        ]

        return [
            {
                "cover_url": Blob.get_cover_url_static(src["uuid"], src["filename"], size="small"),
                "date": src["date"],
                "name": src["name"],
                "tags": src["tags"],
                "url": reverse("blob:detail", kwargs={"uuid": src["uuid"]}),
                "uuid": src["uuid"]
            }
            for hit in book_list["hits"]["hits"]
            for src in [hit["_source"]]
        ]

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the bookshelf view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - tag_list: List of tags with book counts
                - total_count: Total number of books for the user
                - title: Page title "Bookshelf"
        """
        context = super().get_context_data(**kwargs)
        user = cast(User, self.request.user)
        return {
            **context,
            "tag_list": self.tag_list,
            "total_count": Blob.objects.filter(user=user, metadata__name="is_book").count(),
            "title": "Bookshelf"
        }
