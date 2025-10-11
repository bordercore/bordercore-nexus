import datetime
import json
import logging
from typing import Dict, Type

from django.apps import apps
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Model, Q
from django.http import (HttpRequest, HttpResponseRedirect, JsonResponse,
                         StreamingHttpResponse)
from django.shortcuts import render
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views.generic.base import View
from django.views.generic.detail import DetailView
from django.views.generic.edit import CreateView, ModelFormMixin, UpdateView
from django.views.generic.list import ListView

from blob.forms import BlobForm
from blob.models import (Blob, BlobTemplate, BlobToObject, MetaData,
                         RecentlyViewedBlob)
from blob.services import chatbot, get_books, import_blob
from collection.models import Collection, CollectionObject
from lib.mixins import FormRequestMixin
from lib.time_utils import parse_date_from_string

log = logging.getLogger(f"bordercore.{__name__}")


class FormValidMixin(ModelFormMixin):
    """
    A mixin to encapsulate common logic used in Update and Create views
    """

    def form_valid(self, form):

        new_object = not self.object

        blob = form.save(commit=False)

        # Only rename a blob's file if the file itself hasn't changed
        if "file" not in form.changed_data and form.cleaned_data["filename"] != blob.file.name:
            blob.rename_file(form.cleaned_data["filename"])

        blob.user = self.request.user
        blob.file.name = form.cleaned_data["filename"]
        blob.file_modified = form.cleaned_data["file_modified"]
        blob.save()

        # Save the tags
        form.save_m2m()

        handle_metadata(blob, self.request)

        if new_object:
            if "linked_blob_uuid" in self.request.POST:
                linked_blob = Blob.objects.get(uuid=self.request.POST["linked_blob_uuid"])
                BlobToObject.objects.create(node=linked_blob, blob=blob)

            handle_linked_collection(blob, self.request)

            if "collection_uuid" in self.request.POST:
                collection = Collection.objects.get(uuid=self.request.POST.get("collection_uuid"), user=self.request.user)
                collection.add_object(blob)

        blob.index_blob()

        message = "Blob created" if new_object else "Blob updated"
        messages.add_message(self.request, messages.INFO, message)

        return JsonResponse({"status": "OK", "uuid": blob.uuid})

    def form_invalid(self, form):
        """If the form is invalid, return a list of errors."""

        return JsonResponse(form.errors, status=400)


@method_decorator(login_required, name="dispatch")
class BlobListView(ListView):

    model = Blob

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        return {
            **context,
            "title": "Recent Blobs"
        }


@method_decorator(login_required, name="dispatch")
class BlobCreateView(FormRequestMixin, CreateView, FormValidMixin):
    template_name = "blob/update.html"
    form_class = BlobForm

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["action"] = "New"

        if "linked_blob_uuid" in self.request.GET:
            linked_blob = Blob.objects.get(user=self.request.user, uuid=self.request.GET["linked_blob_uuid"])
            context["linked_blob"] = {
                "name": linked_blob.name,
                "thumbnail_url": linked_blob.get_cover_url_small(),
                "uuid": linked_blob.uuid
            }
            # Grab the initial metadata and tags from the linked blob
            context["metadata"] = list(linked_blob.metadata.all().values())
            context["tags"] = [x["name"] for x in linked_blob.tags.all().values()]

        if "linked_collection" in self.request.GET:
            context["linked_collection"] = Collection.objects.get(
                user=self.request.user,
                uuid=self.request.GET["linked_collection"]
            )
            context["tags"] = [
                x.name
                for x in CollectionObject.objects.filter(
                        collection__uuid=self.request.GET["linked_collection"]
                ).first().blob.tags.all()
            ]

        if "metadata" not in context:
            context["metadata"] = []

        if "collection_uuid" in self.request.GET:
            context["collection_info"] = Collection.objects.get(user=self.request.user, uuid=self.request.GET["collection_uuid"])

        context["template_list"] = [
            {
                "uuid": x.uuid,
                "name": x.name,
                "template": x.template,
            } for x in
            BlobTemplate.objects.filter(user=self.request.user)
        ]
        context["title"] = "Create Blob"

        return context

    def get_form(self, form_class=None):
        form = super().get_form(form_class)

        if "is_note" in self.request.GET:
            form.initial["is_note"] = True
            form.initial["math_support"] = True

        if "linked_blob" in self.request.GET:
            blob = Blob.objects.get(user=self.request.user, pk=int(self.request.GET.get("linked_blob")))
            form.initial["tags"] = ",".join([x.name for x in blob.tags.all()])
            form.initial["date"] = blob.date
            form.initial["name"] = blob.name

        if "linked_collection" in self.request.GET:
            collection_uuid = self.request.GET["linked_collection"]
            so = CollectionObject.objects.filter(collection__uuid=collection_uuid).first()
            form.initial["date"] = so.blob.date
            form.initial["name"] = so.blob.name

        return form


@method_decorator(login_required, name="dispatch")
class BlobDetailView(DetailView):

    model = Blob
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        RecentlyViewedBlob.add(self.request.user, blob=self.object)

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

        context["date"] = self.object.get_date()

        if self.object.sha1sum:
            context["aws_url"] = f"https://s3.console.aws.amazon.com/s3/buckets/{settings.AWS_STORAGE_BUCKET_NAME}/blobs/{self.object.uuid}/"

        if self.object.is_note:
            context["is_pinned_note"] = self.object.is_pinned_note()

        try:
            context["elasticsearch_info"] = self.object.get_elasticsearch_info()
        except IndexError:
            # Give Elasticsearch up to a minute to index the blob
            if int(datetime.datetime.now().strftime("%s")) - int(self.object.created.strftime("%s")) > 60:
                messages.add_message(self.request, messages.ERROR, "Blob not found in Elasticsearch")

        context["back_references"] = Blob.back_references(self.object.uuid)
        context["collection_list"] = self.object.get_collections()
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

    def get_queryset(self):
        return Blob.objects.filter(user=self.request.user)


@method_decorator(login_required, name="dispatch")
class BlobUpdateView(FormRequestMixin, UpdateView, FormValidMixin):
    template_name = "blob/update.html"
    form_class = BlobForm

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["sha1sum"] = self.kwargs.get("sha1sum")

        if self.object.sha1sum:
            context["cover_url"] = self.object.get_cover_url()

        context["metadata"] = list(self.object.metadata.exclude(name="is_book").values())
        context["is_book"] = self.object.metadata.filter(name="is_book").exists()
        context["collections_other"] = Collection.objects.filter(
            Q(user=self.request.user)
            & ~Q(collectionobject__blob__uuid=self.object.uuid)
            & Q(is_favorite=True)
        )
        context["date_format"] = "year" if self.object.date_is_year else "standard"
        context["action"] = "Edit"
        context["title"] = self.object.get_name(remove_edition_string=True)
        context["tags"] = [x.name for x in self.object.tags.all()]

        return context

    def get(self, request, *arg, **kwargs):
        self.object = Blob.objects.get(user=self.request.user, uuid=self.kwargs.get("uuid"))
        form_class = self.get_form_class()
        form = self.get_form(form_class)
        context = self.get_context_data(object=self.object, form=form)
        return render(request, self.template_name, context)

    def get_object(self, queryset=None):
        return Blob.objects.get(user=self.request.user, uuid=self.kwargs.get("uuid"))


@method_decorator(login_required, name="dispatch")
class BlobCloneView(View):

    def get(self, request, *args, **kwargs):
        original_blob = Blob.objects.get(uuid=kwargs["uuid"])
        new_blob = original_blob.clone()
        messages.add_message(self.request, messages.INFO, "New blob successfully cloned")
        return HttpResponseRedirect(reverse("blob:detail", kwargs={"uuid": new_blob.uuid}))


@method_decorator(login_required, name="dispatch")
class BlobImportView(View):
    template_name = "blob/import.html"

    def get(self, request, *args, **kwargs):
        return render(request, self.template_name, {})

    def post(self, request, *args, **kwargs):

        url = request.POST.get("url", None)

        try:
            blob = import_blob(request.user, url)
        except Exception as e:
            messages.add_message(request, messages.ERROR, e)

        if not messages.get_messages(request):
            return HttpResponseRedirect(reverse("blob:detail", kwargs={"uuid": blob.uuid}))
        return render(request, self.template_name, {})


# Metadata objects are not handled by the form -- handle them separately
def handle_metadata(blob, request):

    metadata_old = blob.metadata.all()
    for i in metadata_old:
        i.delete()

    if "metadata" in request.POST:
        for pair in json.loads(request.POST["metadata"]):
            new_metadata, created = MetaData.objects.get_or_create(
                blob=blob,
                user=request.user,
                name=pair["name"],
                value=pair["value"]
            )
            if created:
                new_metadata.save()

    if request.POST.get("is_book", ""):
        new_metadata = MetaData(user=request.user, name="is_book", value="true", blob=blob)
        new_metadata.save()


def handle_linked_collection(blob, request):

    if "linked_collection" in request.POST:
        collection = Collection.objects.get(user=request.user, uuid=request.POST["linked_collection"])
        collection.add_object(blob)


@login_required
def metadata_name_search(request):

    m = MetaData.objects.filter(
        user=request.user
    ).values(
        "name"
    ).filter(
        name__icontains=request.GET["query"]
    ).distinct(
        "name"
    ).order_by(
        "name".lower()
    )

    return_data = [{"label": x["name"]} for x in m]

    return JsonResponse(return_data, safe=False)


@login_required
def parse_date(request, input_date):

    error = None
    response = ""

    try:
        response = parse_date_from_string(input_date)
    except ValueError as e:
        error = str(e)

    return JsonResponse({"output_date": response,
                         "error": error})


@login_required
def update_cover_image(request):
    """
    Update the blob's cover image
    """

    blob_uuid = request.POST["blob_uuid"]
    image = request.FILES["image"].read()

    blob = Blob.objects.get(uuid=blob_uuid)
    blob.update_cover_image(image)

    response = {
        "status": "OK"
    }

    return JsonResponse(response)


@login_required
def get_elasticsearch_info(request, uuid):
    """
    Get the Elasticsearch entry for a blob.
    Return an empty dict if not present.
    """

    blob = Blob.objects.get(uuid=uuid)

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
def get_related_objects(request, uuid):
    """
    Get all related objects to a given blob.
    """

    blob = Blob.objects.get(user=request.user, uuid=uuid)

    response = {
        "status": "OK",
        "related_objects": Blob.related_objects("blob", "BlobToObject", blob),
    }

    return JsonResponse(response)


RELATION_MODELS: Dict[str, Type[Model]] = {
    "blob": apps.get_model("blob", "BlobToObject"),
    "drill": apps.get_model("drill", "QuestionToObject"),
}


def get_node_model(node_type: str) -> type:
    """
    Return the relation model class for the given node_type, or raise ValueError.

    Args:
        node_type: A string representing the type of node (e.g., "blob", "drill").

    Returns:
        type: The Django model class associated with the given node_type.

    Raises:
        ValueError: If the node_type is not found in the RELATION_MODELS mapping.
    """
    try:
        return RELATION_MODELS[node_type]
    except KeyError as e:
        raise ValueError(f"Unsupported node_type: {node_type}") from e


@login_required
def add_related_object(request: HttpRequest) -> JsonResponse:
    """
    Link a node (Blob or Question) to a Blob or Bookmark by its UUID.
    Called during new question creation, not during question update.

    Args:
        request (HttpRequest): The incoming HTTP request. Expects the following POST parameters:
            - node_type: Type of the node ("blob" or "drill"). Defaults to "blob".
            - node_uuid: UUID of the node to which the object should be related.
            - object_uuid: UUID of the Blob or Bookmark to be related.

    Returns:
        A response dict with a "status" key (and an optional "message" if there’s an error).
    """

    node_type = request.POST.get("node_type", "blob")
    node_uuid = request.POST.get("node_uuid")
    object_uuid = request.POST.get("object_uuid")

    # Validate inputs
    if not node_uuid or not object_uuid:
        return JsonResponse(
            {"status": "Error", "message": "Missing node_uuid or object_uuid"},
            status=400,
        )

    json_data, status_code = Blob.add_related_object(node_type, node_uuid, object_uuid)
    return JsonResponse(json_data, status=status_code)


@login_required
def remove_related_object(request):
    """
    Remove a relationship between a node and another object.
    """

    node_uuid = request.POST["node_uuid"]
    object_uuid = request.POST["object_uuid"]
    node_type = request.POST.get("node_type", "blob")

    node_model = get_node_model(node_type)

    node_model.objects.get(
        Q(node__uuid=node_uuid)
        & (
            Q(blob__uuid=object_uuid) | Q(bookmark__uuid=object_uuid)
        )
    ).delete()

    response = {
        "status": "OK",
    }

    return JsonResponse(response)


@login_required
def sort_related_objects(request):
    """
    Change the sort order of a node and a related object
    """

    node_uuid = request.POST["node_uuid"]
    object_uuid = request.POST["object_uuid"]
    new_position = int(request.POST["new_position"])
    node_type = request.POST.get("node_type", "blob")

    node_model = get_node_model(node_type)

    node_to_object = node_model.objects.get(
        Q(node__uuid=node_uuid)
        & (
            Q(blob__uuid=object_uuid) | Q(bookmark__uuid=object_uuid)
        )
    )
    node_model.reorder(node_to_object, new_position)

    response = {
        "status": "OK",
    }

    return JsonResponse(response)


@login_required
def update_related_object_note(request):

    node_uuid = request.POST["node_uuid"]
    object_uuid = request.POST["object_uuid"]
    note = request.POST["note"]
    node_type = request.POST.get("node_type", "blob")

    node_model = get_node_model(node_type)

    node_to_object = node_model.objects.get(
        Q(node__uuid=node_uuid)
        & (
            Q(blob__uuid=object_uuid) | Q(bookmark__uuid=object_uuid)
        )
    )
    node_to_object.note = note
    node_to_object.save()

    response = {
        "status": "OK",
    }

    return JsonResponse(response)


@login_required
def update_page_number(request):
    """
    Update the page number for a pdf that represents its cover image
    """

    blob_uuid = request.POST["blob_uuid"]
    page_number = int(request.POST["page_number"])

    blob = Blob.objects.get(uuid=blob_uuid)
    blob.update_page_number(page_number)

    response = {
        "message": "Cover image will be updated soon",
        "status": "OK"
    }

    return JsonResponse(response)


@login_required
def get_template(request):

    template_uuid = request.GET["uuid"]
    blob_template = BlobTemplate.objects.filter(uuid=template_uuid, user=request.user).first()

    if not blob_template:
        return {
            "error": "Template not found"
        }

    response = {
        "template": blob_template.template,
        "status": "OK"
    }

    return JsonResponse(response)


@login_required
def chat(request):

    try:
        content_iterator = chatbot(request, request.POST)
    except Exception as e:
        log.error("Chat service failed for user %s: %s", request.user.id, e, exc_info=True)
        content_iterator = iter([f"An error occurred: {e}"])

    return StreamingHttpResponse(content_iterator, content_type="text/plain")


@method_decorator(login_required, name="dispatch")
class BookshelfListView(ListView):
    template_name = "blob/bookshelf.html"

    def get_queryset(self):
        book_list = get_books(
            self.request.user,
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

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        return {
            **context,
            "tag_list": self.tag_list,
            "total_count": Blob.objects.filter(user=self.request.user, metadata__name="is_book").count(),
            "title": "Bookshelf"
        }
