import json
import random
from urllib.parse import unquote

from django import urls
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseRedirect, JsonResponse
from django.shortcuts import redirect
from django.urls import reverse, reverse_lazy
from django.utils.decorators import method_decorator
from django.views.generic.detail import DetailView
from django.views.generic.edit import CreateView, DeleteView, UpdateView
from django.views.generic.list import ListView

from accounts.models import DrillTag
from blob.models import Blob
from bookmark.models import Bookmark
from drill.forms import QuestionForm
from lib.mixins import FormRequestMixin
from lib.util import parse_title_from_url
from tag.models import Tag

from .models import Question


@method_decorator(login_required, name="dispatch")
class DrillListView(ListView):

    template_name = "drill/drill_list.html"
    queryset = Question.objects.none()

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        return {
            **context,
            "cols": ["tag_name", "question_count", "last_reviewed", "lastreviewed_sort", "id"],
            "title": "Home",
            "tags_last_reviewed": Question.objects.tags_last_reviewed(self.request.user)[:20],
            "random_tag": Question.objects.get_random_tag(self.request.user),
            "favorite_questions_progress": Question.objects.favorite_questions_progress(self.request.user),
            "total_progress": Question.objects.total_tag_progress(self.request.user),
            "study_session_progress": Question.get_study_session_progress(self.request.session)
        }


@method_decorator(login_required, name="dispatch")
class QuestionCreateView(FormRequestMixin, CreateView):
    template_name = "drill/question_edit.html"
    form_class = QuestionForm

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        context["action"] = "New"
        context["title"] = "Drill :: New Question"

        # If we're adding a question with an initial tag value,
        # pre-populate the form with this tag.
        if context["form"]["tags"].value():
            context["tags"] = context["form"]["tags"].value().split(",")

        # Get a list of the most recently used tags
        context["recent_tags"] = Question.objects.recent_tags()[:10]

        return context

    def form_valid(self, form):

        obj = form.save(commit=False)
        obj.user = self.request.user
        obj.save()

        # Save the tags
        form.save_m2m()

        # Index the question and answer in Elasticsearch
        obj.index_question()

        handle_related_objects(obj, self.request)

        review_url = urls.reverse("drill:detail", kwargs={"uuid": obj.uuid})
        messages.add_message(
            self.request,
            messages.INFO, f"Question created. <a href='{review_url}'>Review it here</a>",
            extra_tags="noAutoHide"
        )
        return HttpResponseRedirect(self.get_success_url())

    def get_success_url(self):
        return reverse("drill:add")


def handle_related_objects(question, request):

    info = request.POST.get("related-objects", None)

    if not info:
        return

    for object_info in json.loads(info):
        question.add_related_object(object_info["uuid"])


@method_decorator(login_required, name="dispatch")
class QuestionDeleteView(DeleteView):

    model = Question
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    success_url = reverse_lazy("drill:add")

    def get_queryset(self):
        # Filter the queryset to only include objects owned by the logged-in user
        return self.model.objects.filter(user=self.request.user)

    def form_valid(self, form):
        messages.add_message(
            self.request,
            messages.INFO,
            "Question deleted"
        )
        return super().form_valid(form)


@method_decorator(login_required, name="dispatch")
class QuestionDetailView(DetailView):

    model = Question
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    template_name = "drill/question.html"

    def get_object(self, queryset=None):
        obj = Question.objects.get(user=self.request.user, uuid=self.kwargs.get("uuid"))
        return obj

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        return {
            **context,
            "tag_info": self.object.get_all_tags_progress(),
            "question": self.object,
            "title": "Drill :: Question Detail",
            "tag_list": ", ".join([x.name for x in self.object.tags.all()]),
            "study_session_progress": Question.get_study_session_progress(self.request.session),
            "last_response": self.object.get_last_response(),
            "intervals": self.object.get_intervals(description_only=True),
            "reverse_question": random.randint(1, 2) == 1 if self.object.is_reversible else False,
            "sql_db": self.object.sql_db
        }


@method_decorator(login_required, name="dispatch")
class QuestionUpdateView(FormRequestMixin, UpdateView):
    model = Question
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    form_class = QuestionForm
    template_name = "drill/question_edit.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["action"] = "Edit"
        context["title"] = "Drill :: Edit Question"
        context["tags"] = [x.name for x in self.object.tags.all()]

        # Get a list of the most recently used tags
        context["recent_tags"] = Question.objects.recent_tags()[:10]

        return context

    def form_valid(self, form):

        question = form.instance
        question.tags.set(form.cleaned_data["tags"])
        self.object = form.save()

        # Index the question and answer in Elasticsearch
        question.index_question()

        review_url = urls.reverse("drill:detail", kwargs={"uuid": question.uuid})
        messages.add_message(
            self.request,
            messages.INFO,
            f"Question edited. <a href='{review_url}'>Review it here</a>",
            extra_tags="noAutoHide"
        )

        return HttpResponseRedirect(self.get_success_url())

    def get_success_url(self):

        if "return_url" in self.request.POST:
            return self.request.POST["return_url"]
        return reverse("drill:list")


@login_required
def get_next_question(request):

    if "drill_study_session" in request.session:
        request.session.modified = True

        current_index = request.session["drill_study_session"]["list"].index(request.session["drill_study_session"]["current"])
        if current_index + 1 == len(request.session["drill_study_session"]["list"]):
            messages.add_message(request, messages.INFO, "Study session over.")
            request.session.pop("drill_study_session")
            return redirect("drill:list")
        next_index = current_index + 1
        next_question = request.session["drill_study_session"]["list"][next_index]
        request.session["drill_study_session"]["current"] = next_question
        return redirect("drill:detail", uuid=next_question)

    return redirect("drill:list")


@login_required
def get_current_question(request):

    if "drill_study_session" in request.session:
        current_question = request.session["drill_study_session"]["current"]
        return redirect("drill:detail", uuid=current_question)
    return redirect("drill:list")


@login_required
def start_study_session(request):
    """
    Start a study session
    """
    first_question = Question.start_study_session(
        request.user,
        request.session,
        request.GET["study_method"],
        request.GET.get("filter", "review"),
        {k: v for k, v in request.GET.items() if k in ["count", "interval", "keyword", "tags"]}
    )

    if first_question:
        return redirect("drill:detail", uuid=first_question)

    messages.add_message(
        request,
        messages.WARNING, "No questions found to study"
    )
    return redirect("drill:list")


@login_required
def record_response(request, uuid, response):

    question = Question.objects.get(user=request.user, uuid=uuid)
    question.record_response(response)

    return get_next_question(request)


@login_required
def get_pinned_tags(request):

    tags = Question.objects.get_pinned_tags(request.user)

    response = {
        "status": "OK",
        "tag_list": tags
    }

    return JsonResponse(response)


@login_required
def get_disabled_tags(request):

    tags = Question.objects.get_disabled_tags(request.user)

    response = {
        "status": "OK",
        "tag_list": tags
    }

    return JsonResponse(response)


@login_required
def pin_tag(request):

    tag_name = request.POST["tag"]

    if DrillTag.objects.filter(userprofile=request.user.userprofile, tag__name=tag_name).exists():

        response = {
            "status": "Error",
            "message": "Duplicate: that tag is already pinned."
        }

    else:

        tag = Tag.objects.get(name=tag_name, user=request.user)
        so = DrillTag(userprofile=request.user.userprofile, tag=tag)
        so.save()

        response = {
            "status": "OK"
        }

    return JsonResponse(response)


@login_required
def unpin_tag(request):

    tag_name = request.POST["tag"]

    if not DrillTag.objects.filter(userprofile=request.user.userprofile, tag__name=tag_name).exists():

        response = {
            "status": "Error",
            "message": "That tag is not pinned."
        }

    else:

        so = DrillTag.objects.get(userprofile=request.user.userprofile, tag__name=tag_name)
        so.delete()

        response = {
            "status": "OK"
        }

    return JsonResponse(response)


@login_required
def sort_pinned_tags(request):
    """
    Move a given pinned tag to a new position in a sorted list
    """

    tag_name = request.POST["tag_name"]
    new_position = int(request.POST["new_position"])

    so = DrillTag.objects.get(tag__name=tag_name, userprofile=request.user.userprofile)
    DrillTag.reorder(so, new_position)

    response = {
        "status": "OK"
    }

    return JsonResponse(response)


@login_required
def disable_tag(request):

    tag_name = request.POST["tag"]

    if tag_name in [x["name"] for x in Question.objects.get_disabled_tags(request.user)]:
        response = {
            "status": "Error",
            "message": "Questions with that tag are already disabled."
        }
    else:
        Question.objects.filter(tags__name=tag_name).update(is_disabled=True)
        response = {
            "status": "OK"
        }

    return JsonResponse(response)


@login_required
def enable_tag(request):

    tag_name = request.POST["tag"]

    if tag_name not in [x["name"] for x in Question.objects.get_disabled_tags(request.user)]:
        response = {
            "status": "Error",
            "message": "No question with that tag is disabled."
        }
    else:
        Question.objects.filter(tags__name=tag_name).update(is_disabled=False)

        response = {
            "status": "OK"
        }

    return JsonResponse(response)


@login_required
def is_favorite_mutate(request):

    question_uuid = request.POST["question_uuid"]
    mutation = request.POST["mutation"]

    question = Question.objects.get(uuid=question_uuid)

    if mutation == "add":
        question.is_favorite = True
    elif mutation == "delete":
        question.is_favorite = False

    question.save()

    return JsonResponse({"status": "OK"}, safe=False)


@login_required
def get_title_from_url(request):

    url = unquote(request.GET["url"])

    message = ""
    title = None
    bookmark_uuid = None

    url_info = Bookmark.objects.filter(url=url, user=request.user)
    if url_info:
        title = url_info[0].name
        message = "Existing bookmark found in Bordercore."
        bookmark_uuid = url_info[0].uuid
    else:
        try:
            title = parse_title_from_url(url)[1]
        except Exception as e:
            message = str(e)

    response = {
        "status": "OK",
        "title": title,
        "bookmarkUuid": bookmark_uuid,
        "message": message
    }

    return JsonResponse(response)


def get_related_objects(request, uuid):
    """
    Get all related objects to a given question.
    """

    question = Question.objects.get(user=request.user, uuid=uuid)

    response = {
        "status": "OK",
        "related_objects": Blob.related_objects("drill", "QuestionToObject", question)
    }

    return JsonResponse(response)
