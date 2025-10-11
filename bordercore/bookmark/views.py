import datetime
import html
import re
from urllib.parse import unquote

import lxml.html as lh
import pytz

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.postgres.aggregates import ArrayAgg
from django.core.exceptions import ObjectDoesNotExist
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Count
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse_lazy
from django.utils.decorators import method_decorator
from django.views.generic import CreateView, DeleteView, ListView, UpdateView
from django.views.generic.edit import ModelFormMixin

from accounts.models import UserTag
from blob.models import Blob
from bookmark.forms import BookmarkForm
from bookmark.models import Bookmark
from lib.mixins import FormRequestMixin
from lib.util import get_pagination_range, parse_title_from_url
from tag.models import Tag, TagBookmark

BOOKMARKS_PER_PAGE = 50


@login_required
def click(request, bookmark_uuid=None):

    b = Bookmark.objects.get(user=request.user, uuid=bookmark_uuid) if bookmark_uuid else None
    b.daily["viewed"] = "true"
    b.save()
    return redirect(b.url)


class FormValidMixin(ModelFormMixin):
    """
    A mixin to encapsulate common logic used in Update and Create views
    """

    def form_valid(self, form):

        bookmark = form.instance
        bookmark.user = self.request.user

        if "importance" in self.request.POST:
            bookmark.importance = 10

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


class BookmarkUpdateView(FormRequestMixin, UpdateView, FormValidMixin):
    model = Bookmark
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    template_name = "bookmark/update.html"
    form_class = BookmarkForm
    success_url = reverse_lazy("bookmark:overview")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["action"] = "Edit"
        context["tags"] = [x.name for x in self.object.tags.all()]
        context["back_references"] = Blob.back_references(self.object.uuid)
        context["related_nodes"] = self.object.related_nodes()

        return context


@method_decorator(login_required, name="dispatch")
class BookmarkCreateView(FormRequestMixin, CreateView, FormValidMixin):
    template_name = "bookmark/update.html"
    form_class = BookmarkForm
    success_url = reverse_lazy("bookmark:overview")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["action"] = "Create"
        return context


@method_decorator(login_required, name="dispatch")
class BookmarkDeleteView(DeleteView):
    model = Bookmark
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    success_url = reverse_lazy("bookmark:overview")


@login_required
def delete(request, bookmark_id=None):

    bookmark = Bookmark.objects.get(user=request.user, pk=bookmark_id)
    bookmark.delete()

    return JsonResponse("OK", safe=False)


@login_required
def snarf_link(request):

    url = request.GET["url"]
    name = html.unescape(request.GET["name"])

    # First verify that this url does not already exist
    try:
        b = Bookmark.objects.get(user=request.user, url=url)
        messages.add_message(
            request,
            messages.WARNING,
            f"Bookmark already exists and was added on <strong>{b.created.strftime('%B %d, %Y')}</strong>"
        )
        return redirect("bookmark:update", b.uuid)
    except ObjectDoesNotExist:
        b = Bookmark(is_pinned=False, user=request.user, url=url, name=name)
        b.save()
        b.index_bookmark()
        b.snarf_favicon()

    return redirect("bookmark:update", b.uuid)


@login_required
def get_tags_used_by_bookmarks(request):

    tags = Tag.objects.filter(
        user=request.user,
        bookmark__user=request.user,
        name__icontains=request.GET.get("query", ""),
        bookmark__isnull=False
    ).distinct("name")

    return JsonResponse([{"label": x.name, "is_meta": x.is_meta} for x in tags], safe=False)


def add_bookmarks_from_import(request, tag, bookmarks):
    """
    Add bookmarks with the provided tag. Ignore duplicates.
    """

    added_count = 0
    dupe_count = 0

    for link in bookmarks:
        try:
            Bookmark.objects.get(url=link["url"])
            dupe_count = dupe_count + 1
        except ObjectDoesNotExist:
            b = Bookmark(
                user=request.user,
                url=link["url"],
                name=link["name"],
                created=link["created"],
                modified=link["created"]
            )
            b.save()

            # Add the specified tag to the bookmark.
            # Create the tag if it doesn't exist.
            try:
                t = Tag.objects.get(user=request.user, name=tag)
            except ObjectDoesNotExist:
                t = Tag(name=tag)
                t.save()
            b.tags.set([t])

            # We need to save the model again after adding the tags,
            #  since the b.tags.set() line above *doesn't* call the
            #  Bookmark model's post_save signal.
            b.save()

            b.index_bookmark()
            b.snarf_favicon()
            added_count = added_count + 1

    messages.add_message(request, messages.INFO, f"Bookmarks added: {added_count}. Duplicates ignored: {dupe_count}.")


@login_required
def do_import(request):
    """
    Import bookmarks from a file.
    Supported formats: Google bookmark export format
    """

    if request.method == "POST":

        start = request.POST.get("start_folder", "")
        tag = request.POST.get("tags", "")

        links = []

        try:

            if not tag:
                messages.add_message(request, messages.ERROR, "Please specify a tag")
                raise ValueError()
            if not start:
                messages.add_message(request, messages.ERROR, "Please specify a starting folder")
                raise ValueError()

            xml_string = ""
            for chunk in request.FILES["file"].chunks():
                xml_string = xml_string + str(chunk)

            tree = lh.fromstring(xml_string)

            found = tree.xpath(f"//dt/h3[text()='{start}']/following::dl[1]//a")

            if not found:
                messages.add_message(request, messages.ERROR, "No bookmarks were found")
                raise ValueError()

            for link in found:
                links.append(
                    {
                        "url": link.get("href"),
                        "created": datetime.datetime.fromtimestamp(int(link.get("add_date"))),
                        "name": link.text
                    }
                )

            add_bookmarks_from_import(request, tag, links)

        except ValueError:
            pass

    return render(request, "bookmark/import.html", {})


@login_required
def overview(request):

    sorted_bookmarks = []

    bare_count = Bookmark.objects.bare_bookmarks(
        request.user,
        limit=None,
        sort=False
    ).count()

    pinned_tags = request.user.userprofile.pinned_tags.all().annotate(
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
    paginate_by = 2
    model = Bookmark

    def get_queryset(self):

        query = Bookmark.objects.filter(user=self.request.user)
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

    def get(self, request, *args, **kwargs):
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
                    "favicon_url": x.get_favicon_url(size=16),
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

    def get(self, request, *args, **kwargs):
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
                    "favicon_url": x.bookmark.get_favicon_url(size=16),
                    "tags": x.tags,
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

    def get_queryset(self):

        return TagBookmark.objects.filter(tag__name=self.kwargs.get("tag_filter")) \
                                           .annotate(tags=ArrayAgg("bookmark__tags__name")) \
                                           .select_related("bookmark") \
                                           .order_by("sort_order")


@login_required
def sort_pinned_tags(request):
    """
    Move a given tag to a new position in a sorted list
    """

    tag_id = request.POST["tag_id"]
    new_position = int(request.POST["new_position"])

    if new_position < 1:

        response = {
            "status": "Error",
            "message": f"Position cannot be < 1: {new_position}"
        }

    else:

        tag = Tag.objects.get(user=request.user, id=tag_id)

        s = UserTag.objects.get(userprofile=request.user.userprofile, tag=tag)
        UserTag.reorder(s, new_position)

        response = {
            "status": "OK"
        }

    return JsonResponse(response, safe=False)


@login_required
def sort_bookmarks(request):
    """
    Given an ordered list of bookmarks with a specified tag, move a
    bookmark to a new position within that list
    """

    tag_name = request.POST["tag"]
    bookmark_uuid = request.POST["bookmark_uuid"]
    new_position = int(request.POST["position"])

    s = TagBookmark.objects.get(tag__name=tag_name, bookmark__uuid=bookmark_uuid)
    TagBookmark.reorder(s, new_position)

    return JsonResponse({"status": "OK"}, safe=False)


@login_required
def add_note(request):

    tag_name = request.POST["tag"]
    bookmark_uuid = request.POST["bookmark_uuid"]

    note = request.POST["note"]

    TagBookmark.objects.filter(
        tag__name=tag_name,
        bookmark__uuid=bookmark_uuid
    ).update(note=note)

    return JsonResponse({"status": "OK"}, safe=False)


@login_required
def get_new_bookmarks_count(request, timestamp):
    """
    Get a count of all bookmarks created after the specified timestamp
    """

    time = datetime.datetime.fromtimestamp(timestamp / 1000, pytz.timezone("US/Eastern"))
    count = Bookmark.objects.filter(user=request.user, created__gte=time).count()

    return JsonResponse(
        {
            "status": "OK",
            "count": count
        }
    )


@login_required
def get_title_from_url(request):
    """
    Parse the title from the HTML page pointed to by a url
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
def add_tag(request):

    bookmark_uuid = request.POST["bookmark_uuid"]
    tag_id = request.POST["tag_id"]

    bookmark = Bookmark.objects.get(uuid=bookmark_uuid)
    tag = Tag.objects.get(user=request.user, id=tag_id)

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
def remove_tag(request):

    bookmark_uuid = request.POST["bookmark_uuid"]
    tag_name = request.POST["tag_name"]

    bookmark = Bookmark.objects.get(uuid=bookmark_uuid)
    tag = Tag.objects.get(user=request.user, name=tag_name)

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
