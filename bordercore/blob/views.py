"""Views for the blob application.

This module contains views for managing blobs (files/documents), including
creation, editing, viewing, importing, and managing relationships between
blobs and other objects like collections and nodes.
"""
import json
import logging
import threading
from http import HTTPStatus
from typing import Any, Generator, cast

from botocore.exceptions import BotoCoreError, ClientError

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.db.models import Count, Q
from django.forms import BaseModelForm
from django.http import (HttpRequest, HttpResponse, HttpResponseRedirect,
                         JsonResponse, StreamingHttpResponse)
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST
from django.views.generic.base import View
from django.views.generic.detail import DetailView
from django.views.generic.edit import CreateView, ModelFormMixin, UpdateView
from django.views.generic.list import ListView

from blob.forms import BlobForm
from blob.models import (Blob, BlobTemplate, BlobToObject, MetaData,
                         RecentlyViewedBlob)
from tag.models import Tag
from blob.services import add_related_object as add_related_object_service
from blob.services import (chatbot, chatbot_followups, generate_note_thumbnail,
                           get_books, get_node_to_object_query, import_blob)
from collection.models import Collection, CollectionObject
from lib.decorators import validate_post_data
from lib.exceptions import (InvalidNodeTypeError, NodeNotFoundError,
                            ObjectAlreadyRelatedError,
                            RelatedObjectNotFoundError,
                            UnsupportedNodeTypeError)
from lib.mixins import FormRequestMixin, UserScopedQuerysetMixin, get_user_object_or_404
from lib.time_utils import parse_date_from_string

log = logging.getLogger(f"bordercore.{__name__}")

_EMPTY_FORM_DATA: dict[str, Any] = {
    "name": "",
    "date": "",
    "content": "",
    "note": "",
    "filename": "",
    "importance": False,
    "is_note": False,
    "math_support": False,
}


def _build_form_data_for_json(form: BaseModelForm | None) -> dict[str, Any]:
    """Build form data dict for JSON serialization (avoids escapejs breaking newlines)."""
    if not form:
        return _EMPTY_FORM_DATA
    return {
        "name": str(form["name"].value() or ""),
        "date": str(form["date"].value() or ""),
        "content": str(form["content"].value() or ""),
        "note": str(form["note"].value() or ""),
        "filename": str(form["filename"].value() or ""),
        "importance": form["importance"].value() == 10,
        "is_note": bool(form["is_note"].value()),
        "math_support": bool(form["math_support"].value()),
    }


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

        user = cast(User, self.request.user)

        with transaction.atomic():
            # Only rename a blob's file if the file itself hasn't changed
            # rename_file sets file.name and calls save(), so it needs to be in the transaction
            if "file" not in form.changed_data and form.cleaned_data["filename"] != blob.file.name:
                blob.rename_file(form.cleaned_data["filename"])
            else:
                # Only set file.name if rename_file wasn't called (rename_file sets it internally)
                blob.file.name = form.cleaned_data["filename"]

            blob.user = user
            blob.file_modified = form.cleaned_data["file_modified"]
            blob.save()

            # Save the tags
            form.save_m2m()

            handle_metadata(blob, self.request)

            if new_object:
                if "linked_blob_uuid" in self.request.POST:
                    linked_blob = get_user_object_or_404(user, Blob, uuid=self.request.POST["linked_blob_uuid"])
                    BlobToObject.objects.create(node=linked_blob, blob=blob)

                handle_linked_collection(blob, self.request)

                if "collection_uuid" in self.request.POST:
                    collection = get_user_object_or_404(user, Collection, uuid=self.request.POST["collection_uuid"])
                    collection.add_object(blob)

        if blob.is_note and blob.content and (
            new_object or "content" in form.changed_data or "name" in form.changed_data
        ):
            threading.Thread(
                target=generate_note_thumbnail,
                args=(str(blob.uuid), blob.name, blob.content[:4096]),
                daemon=True,
            ).start()

        # Call index_blob outside the transaction since it's an external service call
        # If indexing fails, we still want the blob to be saved
        try:
            blob.index_blob()
        except (ClientError, BotoCoreError) as e:
            log.error(
                "Failed to trigger Elasticsearch indexing for blob %s: %s",
                blob.uuid,
                e,
                exc_info=True
            )
            messages.add_message(
                self.request,
                messages.WARNING,
                "Blob saved successfully, but indexing may be delayed. "
                "The blob will be indexed automatically when available."
            )
        except Exception as e:
            log.error(
                "Unexpected error triggering Elasticsearch indexing for blob %s: %s",
                blob.uuid,
                e,
                exc_info=True
            )
            messages.add_message(
                self.request,
                messages.WARNING,
                "Blob saved successfully, but indexing may be delayed. "
                "The blob will be indexed automatically when available."
            )

        message = "Blob created" if new_object else "Blob updated"
        messages.add_message(self.request, messages.INFO, message)

        return JsonResponse({"uuid": blob.uuid})

    def form_invalid(self, form: BaseModelForm) -> JsonResponse:
        """Handle an invalid form submission.

        Args:
            form: The invalid form.

        Returns:
            JSON response with form errors and 400 status code.
        """
        return JsonResponse({"detail": form.errors}, status=400)


class BlobListView(LoginRequiredMixin, ListView):
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


class BlobCreateView(LoginRequiredMixin, FormRequestMixin, CreateView, FormValidMixin):
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
            linked_blob = get_user_object_or_404(user, Blob, uuid=self.request.GET["linked_blob_uuid"])
            context["linked_blob"] = {
                "name": linked_blob.name,
                "thumbnail_url": linked_blob.cover_url_small,
                "uuid": linked_blob.uuid
            }
            # Grab the initial metadata and tags from the linked blob
            context["metadata"] = list(linked_blob.metadata.all().values())
            context["tags"] = [x["name"] for x in linked_blob.tags.all().values()]

        if "linked_collection" in self.request.GET:
            context["linked_collection"] = get_user_object_or_404(
                user, Collection, uuid=self.request.GET["linked_collection"]
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

        if "tags" not in context:
            context["tags"] = []

        # Check for data from a generic article import
        imported_data = self.request.session.get("imported_blob_data")
        if imported_data:
            if imported_data.get("url"):
                context["metadata"].append({"name": "Url", "value": imported_data["url"]})
            if imported_data.get("author"):
                context["metadata"].append({"name": "Author", "value": imported_data["author"]})
            # Clear the session data after using it
            del self.request.session["imported_blob_data"]

        if "collection_uuid" in self.request.GET:
            context["collection_info"] = get_user_object_or_404(user, Collection, uuid=self.request.GET["collection_uuid"])

        context["template_list"] = [
            {
                "uuid": x.uuid,
                "name": x.name,
                "template": x.template,
            } for x in
            BlobTemplate.objects.filter(user=user)
        ]
        context["title"] = "Create Blob"

        form = context.get("form")
        context["form_data"] = _build_form_data_for_json(form)

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
            blob = get_user_object_or_404(user, Blob, pk=int(self.request.GET["linked_blob"]))
            form.initial["tags"] = ",".join([x.name for x in blob.tags.all()])
            form.initial["date"] = blob.date
            form.initial["name"] = blob.name

        if "linked_collection" in self.request.GET:
            collection_uuid = self.request.GET["linked_collection"]
            co = CollectionObject.objects.filter(collection__uuid=collection_uuid, collection__user=user).first()
            if co and co.blob:
                form.initial["date"] = co.blob.date
                form.initial["name"] = co.blob.name

        # Check for data from a generic article import
        imported_data = self.request.session.get("imported_blob_data")
        if imported_data:
            if imported_data.get("title"):
                form.initial["name"] = imported_data["title"]
            if imported_data.get("content"):
                form.initial["content"] = imported_data["content"]
            if imported_data.get("date"):
                # Format date with time component to avoid timezone issues in JavaScript
                # JavaScript's new Date("YYYY-MM-DD") interprets as UTC, causing day shifts
                # Using "YYYY-MM-DDT00:00" format ensures it's treated as local time
                date_str = imported_data["date"]
                if len(date_str) == 10:  # YYYY-MM-DD format
                    form.initial["date"] = f"{date_str}T00:00"
                else:
                    form.initial["date"] = date_str

        return form


class BlobDetailView(LoginRequiredMixin, UserScopedQuerysetMixin, DetailView):
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
        collections = self.object.collections
        context["collection_list"] = collections
        context["node_list"] = self.object.get_nodes()
        context["title"] = str(self.object)

        elasticsearch_info = context.get("elasticsearch_info") or {}
        context["show_metadata"] = (
            "content_type" in elasticsearch_info
            or self.object.sha1sum
            or context["metadata_misc"] != {}
        )

        context["tree"] = {
            "label": "Root",
            "nodes": self.object.get_tree()
        }

        context["name"] = self.object.get_name(remove_edition_string=True)

        # JSON serialization for React
        context["blob_json"] = {
            "uuid": str(self.object.uuid),
            "name": self.object.name,
            "editionString": self.object.edition_string or "",
            "subtitle": context["metadata"].get("Subtitle", ""),
            "author": context["metadata"].get("Author", ""),
            "date": context["date"] or "",
            "note": self.object.note or "",
            "content": self.object.content or "",
            "sha1sum": self.object.sha1sum or "",
            "isNote": self.object.is_note,
            "isVideo": self.object.is_video,
            "isImage": self.object.is_image,
            "isPdf": self.object.is_pdf,
            "isAudio": self.object.is_audio,
            "mathSupport": self.object.math_support,
            "hasBeenModified": self.object.has_been_modified,
            "modified": self.object.modified.strftime("%B %-d, %Y") if self.object.has_been_modified else "",
            "created": self.object.created.strftime("%B %-d, %Y"),
            "doctype": self.object.doctype,
            "isIndexed": self.object.is_indexed,
            "coverUrl": self.object.get_cover_url() + "?nodefault=1" if self.object.sha1sum else "",
            "fileUrl": f"{settings.MEDIA_URL}blobs/{self.object.url}" if self.object.sha1sum else "",
            "tags": [
                {
                    "name": tag.name,
                    "url": reverse("search:kb_search_tag_detail", kwargs={"taglist": tag.name}),
                }
                for tag in self.object.tags.all()
            ],
        }

        context["urls_json"] = {
            "edit": reverse("blob:update", kwargs={"uuid": self.object.uuid}),
            "clone": reverse("blob:clone", kwargs={"uuid": self.object.uuid}),
            "create": reverse("blob:create"),
            "list": reverse("blob:list"),
            "delete": reverse("blob-detail", kwargs={"uuid": self.object.uuid}),
            "getElasticsearchInfo": reverse("blob:get_elasticsearch_info", kwargs={"uuid": self.object.uuid}),
            "relatedObjects": reverse("blob:related_objects", kwargs={"uuid": self.object.uuid}),
            "addRelatedObject": reverse("blob:add_related_object"),
            "removeRelatedObject": reverse("blob:remove_related_object"),
            "sortRelatedObjects": reverse("blob:sort_related_objects"),
            "editRelatedObjectNote": reverse("blob:update_related_object_note"),
            "collectionSearch": reverse("collection:search"),
            "addToCollection": reverse("collection:add_object"),
            "createCollection": reverse("collection-list"),
            "pinNote": reverse("accounts:pin_note"),
            "searchNames": reverse("search:search_names"),
            "kbSearchTagDetail": reverse("search:kb_search_tag_detail", kwargs={"taglist": "PLACEHOLDER"}),
            "awsUrl": context.get("aws_url", ""),
            "sqlPlayground": reverse("homepage:sql"),
            "pdfViewer": reverse("blob:pdf_viewer", kwargs={"uuid": self.object.uuid}),
            "rename": reverse("blob:rename", kwargs={"uuid": self.object.uuid}),
        }

        context["blob_urls"] = context["urls"]

        # Transform collection_list to camelCase for React
        context["collection_list"] = [
            {
                "uuid": str(c["uuid"]),
                "name": c["name"],
                "url": c["url"],
                "coverUrl": c["cover_url"],
                "numObjects": c["num_objects"],
                "note": c.get("note", ""),
            }
            for c in collections
        ]

        context["elasticsearch_info_json"] = {
            "contentType": context.get("elasticsearch_info", {}).get("content_type", ""),
            "size": context.get("elasticsearch_info", {}).get("size", ""),
            "numPages": context.get("elasticsearch_info", {}).get("num_pages"),
            "duration": context.get("elasticsearch_info", {}).get("duration", ""),
        } if context.get("elasticsearch_info") else None

        context["tree_json"] = context["tree"]

        context["node_list_json"] = [
            {
                "uuid": str(node.uuid),
                "name": node.name,
                "url": reverse("node:detail", kwargs={"uuid": node.uuid}),
            }
            for node in context["node_list"]
        ]

        return context


@api_view(["POST"])
def rename_blob(request: Request, uuid: str) -> Response:
    """Rename a blob via inline title edit.

    Updates the blob's name field only and re-indexes it. Used by the blob
    detail page's inline-editable h1.

    Args:
        request: HTTP request with form data containing a ``name`` field.
        uuid: UUID of the blob to rename.

    Returns:
        JSON response with the updated name, or 400 on validation error.
    """
    user = cast(User, request.user)
    blob = get_user_object_or_404(user, Blob, uuid=uuid)

    new_name = (request.data.get("name") or "").strip()
    if not new_name:
        return Response({"detail": "name is required"}, status=status.HTTP_400_BAD_REQUEST)

    blob.name = new_name
    blob.save()

    try:
        blob.index_blob(file_changed=False, new_blob=False)
    except (ClientError, BotoCoreError) as e:
        log.warning("Failed to reindex blob %s after rename: %s", blob.uuid, e)

    return Response({"name": blob.name})


class BlobUpdateView(LoginRequiredMixin, FormRequestMixin, UpdateView, FormValidMixin):
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
        context["template_list"] = []  # Templates only used for new blobs

        # Lists for the redesigned edit page's left rail
        context["collection_list"] = self.object.collections
        context["back_references"] = Blob.back_references(self.object.uuid)

        # Surface doctype + file metadata for the React preview pane
        context["doctype"] = self.object.doctype
        context["file_url"] = (
            f"{settings.MEDIA_URL}blobs/{self.object.url}"
            if self.object.sha1sum else ""
        )
        try:
            es_info = self.object.get_elasticsearch_info()
        except Exception:
            es_info = {}
        context["pdf_num_pages"] = es_info.get("num_pages") if es_info else None
        context["file_size"] = es_info.get("size") if es_info else None
        context["duration_label"] = es_info.get("duration") if es_info else None

        form = context.get("form")
        context["form_data"] = _build_form_data_for_json(form)

        return context


class BlobCloneView(LoginRequiredMixin, View):
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
        original_blob = get_user_object_or_404(user, Blob, uuid=kwargs["uuid"])
        new_blob = original_blob.clone()
        messages.add_message(request, messages.INFO, "New blob successfully cloned")
        return HttpResponseRedirect(reverse("blob:detail", kwargs={"uuid": new_blob.uuid}))


class BlobImportView(LoginRequiredMixin, View):
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
            redirect to the create blob page if generic extraction was used,
            or render import template with errors on failure.
        """
        url = request.POST.get("url", None)

        user = cast(User, request.user)
        result: Blob | dict[str, Any] | None = None
        if not url:
            messages.add_message(request, messages.ERROR, "URL is required.")
        else:
            try:
                result = import_blob(user, url)
            except Exception as e:
                messages.add_message(request, messages.ERROR, str(e))

        if result:
            if isinstance(result, Blob):
                return HttpResponseRedirect(reverse("blob:detail", kwargs={"uuid": result.uuid}))
            elif isinstance(result, dict) and result.get("success"):
                # Store the extracted data in the session to be used by BlobCreateView
                request.session["imported_blob_data"] = result
                return HttpResponseRedirect(reverse("blob:create"))

        return render(request, self.template_name, {})


def handle_metadata(blob: Blob, request: HttpRequest) -> None:
    """Handle metadata objects separately from the form.

    Deletes existing metadata and creates new metadata entries based on
    POST data. Also handles the is_book flag.

    Args:
        blob: The blob instance to update metadata for.
        request: The HTTP request containing metadata in POST data.
    """
    user = cast(User, request.user)

    submitted: set[tuple[str, str]] = set()

    if "metadata" in request.POST:
        for pair in json.loads(request.POST["metadata"]):
            submitted.add((pair["name"], pair["value"]))

    if request.POST.get("is_book", ""):
        submitted.add(("is_book", "true"))

    existing = set(blob.metadata.values_list("name", "value"))

    to_delete = existing - submitted
    if to_delete:
        q = Q()
        for name, value in to_delete:
            q |= Q(name=name, value=value)
        blob.metadata.filter(q).delete()

    to_create = submitted - existing
    MetaData.objects.bulk_create([
        MetaData(blob=blob, user=user, name=name, value=value)
        for name, value in to_create
    ])


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
        collection = get_user_object_or_404(user, Collection, uuid=request.POST["linked_collection"])
        collection.add_object(blob)


@api_view(["GET"])
def metadata_name_search(request: HttpRequest) -> Response:
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
    query = request.GET.get("query", "").strip()
    if not query:
        return Response([])

    m = (
        MetaData.objects.filter(user=user, name__icontains=query)
        .values("name")
        .distinct("name")
        .order_by("name")
    )

    return_data = [{"label": x["name"]} for x in m]
    return Response(return_data)


@api_view(["GET"])
def parse_date(request: HttpRequest, input_date: str) -> Response:
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

    return Response({"output_date": response,
                     "message": error})


@api_view(["POST"])
@validate_post_data("blob_uuid")
def update_cover_image(request: HttpRequest) -> Response:
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
    blob = get_user_object_or_404(user, Blob, uuid=blob_uuid)
    blob.update_cover_image(image)

    return Response()


@api_view(["GET"])
def get_elasticsearch_info(request: HttpRequest, uuid: str) -> Response:
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
    blob = get_user_object_or_404(user, Blob, uuid=uuid)

    try:
        info = blob.get_elasticsearch_info()
    except IndexError:
        info = {}

    response = {
        "info": info,
    }

    return Response(response)


@api_view(["GET"])
def get_related_objects(request: HttpRequest, uuid: str) -> Response:
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
    blob = get_user_object_or_404(user, Blob, uuid=uuid)

    response = {
        "related_objects": Blob.related_objects("blob", "BlobToObject", blob),
    }

    return Response(response)


@api_view(["POST"])
@validate_post_data("node_uuid", "object_uuid")
def add_related_object(request: HttpRequest) -> Response:
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
        user = cast(User, request.user)
        result = add_related_object_service(node_type, node_uuid, object_uuid, user)
        return Response(result, status=200)
    except UnsupportedNodeTypeError as e:
        return Response({"detail": str(e)}, status=400)
    except InvalidNodeTypeError as e:
        return Response({"detail": str(e)}, status=400)
    except NodeNotFoundError as e:
        return Response({"detail": str(e)}, status=404)
    except RelatedObjectNotFoundError as e:
        return Response({"detail": str(e)}, status=400)
    except ObjectAlreadyRelatedError as e:
        return Response({"detail": str(e)}, status=400)


@api_view(["POST"])
@validate_post_data("node_uuid", "object_uuid")
def remove_related_object(request: HttpRequest) -> Response:
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

    get_object_or_404(
        cast(Any, node_model), get_node_to_object_query(node_uuid, object_uuid, user)
    ).delete()

    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@validate_post_data("node_uuid", "object_uuid", "new_position")
def sort_related_objects(request: HttpRequest) -> Response:
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

    node_to_object = get_object_or_404(
        cast(Any, node_model), get_node_to_object_query(node_uuid, object_uuid, user)
    )
    cast(Any, node_model).reorder(node_to_object, new_position)

    return Response()


@api_view(["POST"])
@validate_post_data("node_uuid", "object_uuid", "note")
def update_related_object_note(request: HttpRequest) -> Response:
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

    node_to_object = get_object_or_404(
        cast(Any, node_model), get_node_to_object_query(node_uuid, object_uuid, user)
    )
    node_to_object.note = note
    node_to_object.save()

    return Response()


@api_view(["POST"])
@validate_post_data("blob_uuid", "page_number")
def update_page_number(request: HttpRequest) -> Response:
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
    blob = get_user_object_or_404(user, Blob, uuid=blob_uuid)
    blob.update_page_number(page_number)

    response = {
        "message": "Cover image will be updated soon",
    }

    return Response(response)


@login_required
def pdf_viewer(request: HttpRequest, uuid: str) -> HttpResponse:
    """Render the pdf.js viewer page for a blob's PDF file."""
    user = cast(User, request.user)
    blob = get_user_object_or_404(user, Blob, uuid=uuid)
    file_url = reverse("blob:file", kwargs={"uuid": uuid})
    search_term = request.GET.get("search", "")
    return render(request, "blob/pdf_viewer.html", {
        "blob": blob,
        "file_url": file_url,
        "search_term": search_term,
    })


@login_required
def blob_file_serve(request: HttpRequest, uuid: str) -> HttpResponse | StreamingHttpResponse:
    """Serve a blob's file through Django.

    This acts as a proxy to S3, allowing authenticated users to access
    files without needing a public S3 bucket or CORS configuration.

    Args:
        request: The HTTP request.
        uuid: UUID of the blob to serve.

    Returns:
        HttpResponse or StreamingHttpResponse with the file content.
    """
    user = cast(User, request.user)
    try:
        blob = Blob.objects.get(uuid=uuid, user=user)
    except Blob.DoesNotExist:
        log.error("Blob not found for uuid=%s and user=%s", uuid, user.id)
        return HttpResponse("Blob not found", status=404)
    except Exception as e:
        log.error("Error fetching blob %s: %s", uuid, e, exc_info=True)
        return HttpResponse("Error fetching blob", status=500)

    if not blob.file:
        return HttpResponse("Blob has no file", status=404)

    try:
        # Construct the correct S3 path relative to the bucket root
        from django.core.files.storage import default_storage
        file_path = f"blobs/{blob.uuid}/{blob.file.name}"

        if not default_storage.exists(file_path):
            log.error("File not found in storage: %s", file_path)
            return HttpResponse("File not found in storage", status=404)

        # Use StreamingHttpResponse with the storage backend's open method
        import os
        filename = os.path.basename(blob.file.name)
        content_type = "application/pdf" if filename.lower().endswith(".pdf") else "application/octet-stream"
        response = StreamingHttpResponse(default_storage.open(file_path, "rb"), content_type=content_type)

        # PDFs served inline (for pdf.js viewer); other files as attachment (download)
        disposition = "inline" if filename.lower().endswith(".pdf") else "attachment"
        response["Content-Disposition"] = f'{disposition}; filename="{filename}"'

        return response
    except Exception as e:
        log.error("Failed to serve blob file %s: %s", uuid, e, exc_info=True)
        return HttpResponse("Error serving file", status=500)


@api_view(["GET"])
def get_template(request: HttpRequest) -> Response:
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
        return Response({
            "message": "Template not found"
        }, status=HTTPStatus.NOT_FOUND)

    response = {
        "template": blob_template.template,
    }

    return Response(response)


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
            yield "An unexpected error occurred. Please try again later."
        content_iterator = error_generator()

    return StreamingHttpResponse(content_iterator, content_type="text/plain")


@api_view(["POST"])
def chat_followups(request: Request) -> Response:
    """Return 2-3 suggested follow-up prompts for a given assistant reply."""
    assistant_reply = request.data.get("assistant_reply", "")
    mode = request.data.get("mode", "chat")
    suggestions = chatbot_followups(assistant_reply, mode=mode)
    return Response({"suggestions": suggestions})


@api_view(["POST"])
def chat_save_as_note(request: Request) -> Response:
    """Create a note-typed Blob from a chatbot assistant reply.

    Body: { title: str, tags: str (comma-separated, optional), content: str }
    Returns: { uuid: str, url: str }
    """
    user = cast(User, request.user)
    title = (request.data.get("title") or "").strip()
    content = request.data.get("content") or ""
    tags_raw = request.data.get("tags") or ""

    if not title:
        return Response(
            {"error": "title is required"},
            status=HTTPStatus.BAD_REQUEST,
        )

    with transaction.atomic():
        blob = Blob.objects.create(
            user=user,
            name=title,
            content=content,
            is_note=True,
        )

        tag_names = [t.strip() for t in tags_raw.split(",") if t.strip()]
        for tag_name in tag_names:
            tag, _ = Tag.objects.get_or_create(name=tag_name, user=user)
            blob.tags.add(tag)

    return Response({
        "uuid": str(blob.uuid),
        "url": reverse("blob:detail", kwargs={"uuid": blob.uuid}),
    })


class BookshelfListView(LoginRequiredMixin, ListView):
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
