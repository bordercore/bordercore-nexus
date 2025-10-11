import datetime
import hashlib
from io import BytesIO

from rest_framework.decorators import api_view

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Count, Exists, OuterRef, Q
from django.forms.models import model_to_dict
from django.http import HttpResponseRedirect, JsonResponse
from django.urls import reverse, reverse_lazy
from django.utils.decorators import method_decorator
from django.views.generic.detail import DetailView
from django.views.generic.edit import (CreateView, DeleteView, FormMixin,
                                       UpdateView)
from django.views.generic.list import ListView

from blob.models import Blob
from bookmark.models import Bookmark
from collection.forms import CollectionForm
from collection.models import Collection, CollectionObject
from lib.exceptions import DuplicateObjectError
from lib.mixins import FormRequestMixin
from lib.util import parse_title_from_url
from tag.models import Tag


@method_decorator(login_required, name="dispatch")
class CollectionListView(FormRequestMixin, FormMixin, ListView):

    form_class = CollectionForm

    def get_queryset(self):

        query = Collection.objects.filter(
            user=self.request.user,
            is_favorite=True
        )

        if "query" in self.request.GET:
            query = query.filter(name__icontains=self.request.GET.get("query"))

        query = query.annotate(num_blobs=Count("collectionobject"))

        query = query.order_by("-modified")

        return query

    def get_context_data(self, **kwargs):
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

    model = Collection
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    form_class = CollectionForm

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        context["tags"] = [x.name for x in self.object.tags.all()]

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
    template_name = "collection/collection_list.html"
    form_class = CollectionForm

    def form_valid(self, form):
        collection = form.save(commit=False)
        collection.user = self.request.user
        collection.save()

        # Save the tags
        form.save_m2m()

        return HttpResponseRedirect(self.get_success_url())

    def get_success_url(self):
        return reverse("collection:list")


@method_decorator(login_required, name="dispatch")
class CollectionUpdateView(FormRequestMixin, UpdateView):

    model = Collection
    form_class = CollectionForm
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def get_queryset(self):
        base_qs = super().get_queryset()
        return base_qs.filter(user=self.request.user)

    def form_valid(self, form):
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

    model = Collection
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    success_url = reverse_lazy("collection:list")

    def get_queryset(self):
        # Filter the queryset to only include objects owned by the logged-in user
        return self.model.objects.filter(user=self.request.user)

    def form_valid(self, form):
        messages.add_message(
            self.request,
            messages.INFO,
            f"Collection <strong>{self.object.name}</strong> deleted"
        )
        return super().form_valid(form)


@login_required
def get_blob(request, collection_uuid):

    collection = Collection.objects.get(uuid=collection_uuid)
    direction = request.GET.get("direction", "next")
    blob_position = int(request.GET.get("position", 0))
    tag_name = request.GET.get("tag", None)
    randomize = request.GET.get("randomize", "") == "true"

    return JsonResponse(collection.get_blob(blob_position, direction, randomize, tag_name))


@api_view(["GET"])
def get_images(request, collection_uuid):
    """
    Get four recent images from a collection, to be used in
    creating a thumbnail image.
    """
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
def search(request):

    query = Collection.objects.filter(user=request.user)

    query = query.annotate(num_objects=Count("collectionobject"))

    if "query" in request.GET:
        query = query.filter(name__icontains=request.GET.get("query"))

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
def create_blob(request):

    collection_uuid = request.POST["collection_uuid"]
    file_contents = request.FILES["blob"].read()
    sha1sum = hashlib.sha1(file_contents).hexdigest()

    dupe_check = Blob.objects.filter(sha1sum=sha1sum, user=request.user)

    if dupe_check:

        blob_url = reverse("blob:detail", kwargs={"uuid": dupe_check.first().uuid})
        response = {
            "status": "Error",
            "message": f"This blob <a href='{blob_url}'>already exists</a>."
        }

    else:

        blob = Blob.objects.create(
            user=request.user,
            date=datetime.datetime.now().strftime("%Y-%m-%d")
        )

        blob.file_modified = datetime.datetime.now().strftime("%s")
        blob.file.save(request.FILES["blob"].name, BytesIO(file_contents))
        blob.sha1sum = hashlib.sha1(file_contents).hexdigest()
        blob.save()

        blob.index_blob()

        collection = Collection.objects.get(uuid=collection_uuid, user=request.user)
        collection.add_object(blob)

        response = {
            "status": "OK",
            "blob_uuid": blob.uuid
        }

    return JsonResponse(response)


@login_required
def get_object_list(request, collection_uuid):

    collection = Collection.objects.get(uuid=collection_uuid)
    random_order = request.GET.get("random_order", "false") in ("true")

    object_list = collection.get_object_list(
        request=request,
        page_number=int(request.GET.get("pageNumber", 1)),
        random_order=random_order
    )

    return JsonResponse(object_list, safe=False)


@login_required
def add_object(request):

    collection_uuid = request.POST["collection_uuid"]
    blob_uuid = request.POST.get("blob_uuid", None)
    bookmark_uuid = request.POST.get("bookmark_uuid", None)

    collection = Collection.objects.get(uuid=collection_uuid)

    if blob_uuid:
        object = Blob.objects.get(uuid=blob_uuid)
    elif bookmark_uuid:
        object = Bookmark.objects.get(uuid=bookmark_uuid)
    else:
        return JsonResponse(
            {
                "status": "Error",
                "message": "You must specify a blob_uuid or bookmark_uuid"
            }
        )

    try:
        collection.add_object(object)
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
def remove_object(request):

    collection_uuid = request.POST["collection_uuid"]
    object_uuid = request.POST["object_uuid"]

    collection = Collection.objects.get(uuid=collection_uuid)
    collection.remove_object(object_uuid)

    response = {
        "status": "OK",
    }

    return JsonResponse(response)


@login_required
def sort_objects(request):
    """
    Move a given object to a new position in a sorted list
    """

    collection_uuid = request.POST["collection_uuid"]
    object_uuid = request.POST["object_uuid"]
    new_position = int(request.POST["new_position"])

    so = CollectionObject.objects.get(
        Q(blob__uuid=object_uuid) | Q(bookmark__uuid=object_uuid),
        collection__uuid=collection_uuid
    )
    CollectionObject.reorder(so, new_position)

    response = {
        "status": "OK",
    }

    return JsonResponse(response)


@login_required
def update_object_note(request):

    collection_uuid = request.POST["collection_uuid"]
    object_uuid = request.POST["object_uuid"]
    note = request.POST["note"]

    so = CollectionObject.objects.get(
        Q(blob__uuid=object_uuid) | Q(bookmark__uuid=object_uuid),
        collection__uuid=collection_uuid
    )
    so.note = note
    so.save()

    response = {
        "status": "OK",
    }

    return JsonResponse(response)


@login_required
def add_new_bookmark(request):

    collection_uuid = request.POST["collection_uuid"]
    url = request.POST["url"]

    bookmark = None
    try:
        bookmark = Bookmark.objects.get(user=request.user, url=url)
    except ObjectDoesNotExist:
        pass

    if not bookmark:
        title = parse_title_from_url(url)[1]

        bookmark = Bookmark.objects.create(
            user=request.user,
            name=title,
            url=url
        )
        bookmark.index_bookmark()

    collection = Collection.objects.get(uuid=collection_uuid)

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
