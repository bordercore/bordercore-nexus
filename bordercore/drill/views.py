"""Views for the drill application.

This module contains views for managing questions, study sessions,
and tag-related operations in the drill/flashcard system.
"""
import json
import random
from typing import Any, Dict, cast
from urllib.parse import unquote

from django import urls
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.db.models import QuerySet
from django.db.models.query import QuerySet as QuerySetType
from django.forms import BaseModelForm
from django.http import (HttpRequest, HttpResponse, HttpResponseRedirect,
                         JsonResponse)
from django.shortcuts import redirect
from django.urls import reverse, reverse_lazy
from django.views.decorators.http import require_POST
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


class DrillListView(LoginRequiredMixin, ListView):
    """View for displaying the drill question list page.

    Shows tags with their question counts, last reviewed dates, progress information,
    and study session progress.
    """

    template_name = "drill/drill_list.html"
    queryset = Question.objects.none()

    def get_context_data(self, **kwargs: Any) -> Dict[str, Any]:
        """Get context data for the drill list view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - cols: Column names for the table
                - title: Page title
                - tags_last_reviewed: List of tags with last reviewed dates
                - random_tag: A random tag for the user
                - favorite_questions_progress: Progress on favorite questions
                - total_progress: Total tag progress for the user
                - study_session_progress: Current study session progress
                - JSON versions of the above for React
        """
        context = super().get_context_data(**kwargs)

        user = cast(User, self.request.user)

        tags_last_reviewed = Question.objects.tags_last_reviewed(user)[:20]
        random_tag = Question.objects.get_random_tag(user)
        favorite_questions_progress = Question.objects.favorite_questions_progress(user)
        total_progress = Question.objects.total_tag_progress(user)
        study_session_progress = Question.get_study_session_progress(self.request.session)

        # Get study session from request for React
        study_session = self.request.session.get("drill_study_session", None)

        return {
            **context,
            "cols": ["tag_name", "question_count", "last_reviewed", "lastreviewed_sort", "id"],
            "title": "Home",
            "tags_last_reviewed": tags_last_reviewed,
            "random_tag": random_tag,
            "favorite_questions_progress": favorite_questions_progress,
            "total_progress": total_progress,
            "study_session_progress": study_session_progress,
            # JSON versions for React
            "study_session_json": json.dumps(study_session) if study_session else "null",
            "total_progress_json": json.dumps({"count": total_progress["count"], "percentage": total_progress["percentage"]}),
            "favorite_progress_json": json.dumps({"count": favorite_questions_progress["count"], "percentage": favorite_questions_progress["percentage"]}),
            "tags_last_reviewed_json": json.dumps([
                {"name": t.name, "last_reviewed": (lr.strftime("%B %d, %Y") if lr else None)}
                for t in tags_last_reviewed
                for lr in [getattr(t, "last_reviewed", None)]
            ]),
            "featured_tag_json": json.dumps(random_tag) if random_tag else "null",
        }


class QuestionCreateView(LoginRequiredMixin, FormRequestMixin, CreateView):
    """View for creating a new question.

    Handles the creation of new drill questions, including saving tags
    and indexing the question in Elasticsearch.
    """

    template_name = "drill/question_edit.html"
    form_class = QuestionForm

    def get_context_data(self, **kwargs: Any) -> Dict[str, Any]:
        """Get context data for the question creation form.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - action: "New" to indicate creation mode
                - title: Page title
                - tags: Pre-populated tags if provided in initial data
                - recent_tags: List of most recently used tags
        """
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

    def form_valid(self, form: BaseModelForm) -> HttpResponseRedirect:
        """Handle a valid form submission.

        Saves the question, associates it with the current user, saves tags,
        indexes the question in Elasticsearch, and handles related objects.

        Args:
            form: The validated question form.

        Returns:
            Redirect to the success URL with a success message.
        """
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

    def get_success_url(self) -> str:
        """Get the URL to redirect to after successful form submission.

        Returns:
            URL for the question creation page.
        """
        return reverse("drill:add")


def handle_related_objects(question: Question, request: HttpRequest) -> None:
    """Handle adding related objects to a question.

    Parses related object information from the request POST data and
    associates them with the question.

    Args:
        question: The Question instance to add related objects to.
        request: The HTTP request containing related object data in POST.
    """
    info = request.POST.get("related-objects", None)

    if not info:
        return

    for object_info in json.loads(info):
        question.add_related_object(object_info["uuid"])


class QuestionDeleteView(LoginRequiredMixin, DeleteView):
    """View for deleting a question.

    Allows users to delete their own questions. Filters questions to
    only show those owned by the logged-in user.
    """

    model = Question
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    success_url = reverse_lazy("drill:add")

    def get_queryset(self) -> QuerySet[Question]:
        """Get the queryset filtered to the current user's questions.

        Returns:
            Questions owned by the logged-in user.
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
            "Question deleted"
        )
        return super().form_valid(form)


class QuestionDetailView(LoginRequiredMixin, DetailView):
    """View for displaying a question detail page.

    Shows a single question with its tags, progress information, intervals,
    and study session context.
    """

    model = Question
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    template_name = "drill/question.html"

    def get_queryset(self) -> QuerySetType[Question]:
        """Get the queryset of questions for the current user.

        Returns:
            QuerySet of Question objects filtered by user.
        """
        user = cast(User, self.request.user)
        return Question.objects.filter(user=user)

    def get_context_data(self, **kwargs: Any) -> Dict[str, Any]:
        """Get context data for the question detail view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - tag_info: Progress information for all tags
                - question: The question object
                - title: Page title
                - tag_list: Comma-separated list of tag names
                - study_session_progress: Current study session progress
                - last_response: The last response recorded for this question
                - intervals: Question intervals (description only)
                - reverse_question: Whether to show the question in reverse
                - sql_db: SQL database information if applicable
                - JSON versions of the above for React
        """
        context = super().get_context_data(**kwargs)

        tag_info = self.object.get_all_tags_progress()
        last_response = self.object.get_last_response()
        intervals = self.object.get_intervals(description_only=True)
        reverse_question = self.object.is_reversible and random.choice([True, False])
        sql_db = self.object.sql_db
        study_session = self.request.session.get("drill_study_session", None)
        study_session_progress = Question.get_study_session_progress(self.request.session)

        # Build question JSON for React
        question_json = {
            "uuid": str(self.object.uuid),
            "question": self.object.question,
            "answer": self.object.answer,
            "lastReviewed": self.object.last_reviewed.strftime("%B %d, %Y") if self.object.last_reviewed else None,
            "interval": self.object.interval.days,
            "needsReview": self.object.needs_review,
            "isFavorite": self.object.is_favorite,
            "isDisabled": self.object.is_disabled,
            "isReversible": self.object.is_reversible,
            "tags": [{"name": tag.name} for tag in self.object.tags.all()],
        }

        # Build SQL db JSON if present
        sql_db_json = None
        if sql_db:
            sql_db_json = {"blob": {"uuid": str(sql_db.blob.uuid)}}

        return {
            **context,
            "tag_info": tag_info,
            "question": self.object,
            "title": "Drill :: Question Detail",
            "tag_list": ", ".join([x.name for x in self.object.tags.all()]),
            "study_session_progress": study_session_progress,
            "last_response": last_response,
            "intervals": intervals,
            "reverse_question": reverse_question,
            "sql_db": sql_db,
            # JSON versions for React
            "question_json": json.dumps(question_json),
            "tag_info_json": json.dumps(tag_info),
            "intervals_json": json.dumps(intervals),
            "study_session_json": json.dumps(study_session) if study_session else "null",
            "sql_db_json": json.dumps(sql_db_json) if sql_db_json else "null",
        }


class QuestionUpdateView(LoginRequiredMixin, FormRequestMixin, UpdateView):
    """View for updating an existing question.

    Handles editing of drill questions, including updating tags
    and re-indexing the question in Elasticsearch.
    """

    model = Question
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    form_class = QuestionForm
    template_name = "drill/question_edit.html"

    def get_queryset(self) -> QuerySetType[Question]:
        """Limit updates to the current user's questions.

        Returns:
            QuerySet of Question objects for this user.
        """
        user = cast(User, self.request.user)
        return Question.objects.filter(user=user).prefetch_related("tags")

    def get_context_data(self, **kwargs: Any) -> Dict[str, Any]:
        """Get context data for the question edit form.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - action: "Edit" to indicate edit mode
                - title: Page title
                - tags: List of current tag names
                - recent_tags: List of most recently used tags
        """
        context = super().get_context_data(**kwargs)
        context["action"] = "Edit"
        context["title"] = "Drill :: Edit Question"
        context["tags"] = [x.name for x in self.object.tags.all()]

        # Get a list of the most recently used tags
        context["recent_tags"] = Question.objects.recent_tags()[:10]

        return context

    def form_valid(self, form: BaseModelForm) -> HttpResponseRedirect:
        """Handle a valid form submission.

        Updates the question, saves tags, and re-indexes the question
        in Elasticsearch.

        Args:
            form: The validated question form.

        Returns:
            HTTP redirect to the success URL.
        """
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

    def get_success_url(self) -> str:
        """Get the URL to redirect to after successful form submission.

        Returns the return_url from POST if provided, otherwise redirects
        to the drill list page.

        Returns:
            URL to redirect to after successful update.
        """
        if "return_url" in self.request.POST:
            return self.request.POST["return_url"]
        return reverse("drill:list")


@login_required
def get_next_question(request: HttpRequest) -> HttpResponseRedirect:
    """Get the next question in the current study session.

    Advances to the next question in the study session. If the session
    is complete, clears it and redirects to the drill list.

    Args:
        request: The HTTP request containing the study session data.

    Returns:
        Redirect to the next question detail page,
            or to the drill list if the session is complete.
    """
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
def get_current_question(request: HttpRequest) -> HttpResponseRedirect:
    """Get the current question in the study session.

    Redirects to the detail page of the current question in the active
    study session.

    Args:
        request: The HTTP request containing the study session data.

        Returns:
            Redirect to the current question detail page,
                or to the drill list if no session is active.
    """
    if "drill_study_session" in request.session:
        current_question = request.session["drill_study_session"]["current"]
        return redirect("drill:detail", uuid=current_question)
    return redirect("drill:list")


@login_required
def start_study_session(request: HttpRequest) -> HttpResponseRedirect:
    """Start a new study session.

    Initializes a study session based on the study method and filters
    provided in the request GET parameters.

    Args:
        request: The HTTP request containing study session parameters:
            - study_method: The method to use for selecting questions
            - filter: Filter type (default: "review")
            - count: Number of questions to include (optional)
            - interval: Interval filter (optional)
            - keyword: Keyword filter (optional)
            - tags: Tag filter (optional)

        Returns:
            Redirect to the first question in the session,
                or to the drill list with a warning if no questions are found.
    """
    user = cast(User, request.user)
    first_question = Question.start_study_session(
        user,
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
def record_response(request: HttpRequest, uuid: str, response: str) -> HttpResponseRedirect:
    """Record a user's response to a question.

    Records the user's response (e.g., correct/incorrect) and advances
    to the next question in the study session.

    Args:
        request: The HTTP request.
        uuid: The UUID of the question being answered.
        response: The response value to record.

    Returns:
        Redirect to the next question in the session.
    """
    user = cast(User, request.user)
    question = Question.objects.get(user=user, uuid=uuid)
    question.record_response(response)

    return get_next_question(request)


@login_required
def get_pinned_tags(request: HttpRequest) -> JsonResponse:
    """Get a list of pinned tags for the current user.

    Args:
        request: The HTTP request.

    Returns:
        JSON response containing:
            - status: "OK"
            - tag_list: List of pinned tags
    """
    user = cast(User, request.user)
    tags = Question.objects.get_pinned_tags(user)

    response = {
        "status": "OK",
        "tag_list": tags
    }

    return JsonResponse(response)


@login_required
def get_disabled_tags(request: HttpRequest) -> JsonResponse:
    """Get a list of disabled tags for the current user.

    Args:
        request: The HTTP request.

    Returns:
        JSON response containing:
            - status: "OK"
            - tag_list: List of disabled tags
    """
    user = cast(User, request.user)
    tags = Question.objects.get_disabled_tags(user)

    response = {
        "status": "OK",
        "tag_list": tags
    }

    return JsonResponse(response)


@login_required
@require_POST
def pin_tag(request: HttpRequest) -> JsonResponse:
    """Pin a tag for the current user.

    Creates a DrillTag association to pin a tag. Returns an error if
    the tag is already pinned.

    Args:
        request: The HTTP request containing:
            - tag: The name of the tag to pin

    Returns:
        JSON response containing:
            - status: "OK" on success, "Error" on failure
            - message: Error message if status is "Error"
    """
    tag_name = request.POST["tag"]

    user = cast(User, request.user)
    if DrillTag.objects.filter(userprofile=user.userprofile, tag__name=tag_name).exists():

        response = {
            "status": "Error",
            "message": "Duplicate: that tag is already pinned."
        }

    else:

        tag = Tag.objects.get(name=tag_name, user=user)
        so = DrillTag(userprofile=user.userprofile, tag=tag)
        so.save()

        response = {
            "status": "OK"
        }

    return JsonResponse(response)


@login_required
@require_POST
def unpin_tag(request: HttpRequest) -> JsonResponse:
    """Unpin a tag for the current user.

    Removes the DrillTag association to unpin a tag. Returns an error
    if the tag is not currently pinned.

    Args:
        request: The HTTP request containing:
            - tag: The name of the tag to unpin

    Returns:
        JSON response containing:
            - status: "OK" on success, "Error" on failure
            - message: Error message if status is "Error"
    """
    tag_name = request.POST["tag"]

    user = cast(User, request.user)
    if not DrillTag.objects.filter(userprofile=user.userprofile, tag__name=tag_name).exists():

        response = {
            "status": "Error",
            "message": "That tag is not pinned."
        }

    else:

        so = DrillTag.objects.get(userprofile=user.userprofile, tag__name=tag_name)
        so.delete()

        response = {
            "status": "OK"
        }

    return JsonResponse(response)


@login_required
@require_POST
def sort_pinned_tags(request: HttpRequest) -> JsonResponse:
    """Reorder a pinned tag to a new position.

    Moves a pinned tag to a new position in the sorted list of pinned tags.

    Args:
        request: The HTTP request containing:
            - tag_name: The name of the tag to reorder
            - new_position: The new position index for the tag

    Returns:
        JSON response with operation status.
    """

    tag_name = request.POST["tag_name"]
    new_position = int(request.POST["new_position"])

    user = cast(User, request.user)
    so = DrillTag.objects.get(tag__name=tag_name, userprofile=user.userprofile)
    DrillTag.reorder(so, new_position)

    response = {
        "status": "OK"
    }

    return JsonResponse(response)


@login_required
@require_POST
def disable_tag(request: HttpRequest) -> JsonResponse:
    """Disable all questions with a given tag.

    Marks all questions with the specified tag as disabled. Returns an
    error if questions with that tag are already disabled.

    Args:
        request: The HTTP request containing:
            - tag: The name of the tag to disable

    Returns:
        JSON response containing:
            - status: "OK" on success, "Error" on failure
            - message: Error message if status is "Error"
    """
    tag_name = request.POST["tag"]

    user = cast(User, request.user)
    if tag_name in {x["name"] for x in Question.objects.get_disabled_tags(user)}:
        response = {
            "status": "Error",
            "message": "Questions with that tag are already disabled."
        }
    else:
        Question.objects.filter(tags__name=tag_name, user=user).update(is_disabled=True)
        response = {
            "status": "OK"
        }

    return JsonResponse(response)


@login_required
@require_POST
def enable_tag(request: HttpRequest) -> JsonResponse:
    """Enable all questions with a given tag.

    Marks all questions with the specified tag as enabled. Returns an
    error if no questions with that tag are currently disabled.

    Args:
        request: The HTTP request containing:
            - tag: The name of the tag to enable

    Returns:
        JSON response containing:
            - status: "OK" on success, "Error" on failure
            - message: Error message if status is "Error"
    """
    tag_name = request.POST["tag"]

    user = cast(User, request.user)
    if tag_name not in {x["name"] for x in Question.objects.get_disabled_tags(user)}:
        response = {
            "status": "Error",
            "message": "No question with that tag is disabled."
        }
    else:
        Question.objects.filter(tags__name=tag_name, user=user).update(is_disabled=False)

        response = {
            "status": "OK"
        }

    return JsonResponse(response)


@login_required
@require_POST
def is_favorite_mutate(request: HttpRequest) -> JsonResponse:
    """Add or remove a question from favorites.

    Updates the favorite status of a question based on the mutation type.

    Args:
        request: The HTTP request containing:
            - question_uuid: The UUID of the question to modify
            - mutation: Either "add" to favorite or "delete" to unfavorite

    Returns:
        JSON response containing:
            - status: "OK"
    """
    question_uuid = request.POST["question_uuid"]
    mutation = request.POST["mutation"]

    user = cast(User, request.user)
    question = Question.objects.get(uuid=question_uuid, user=user)

    if mutation == "add":
        question.is_favorite = True
    elif mutation == "delete":
        question.is_favorite = False

    question.save()

    return JsonResponse({"status": "OK"})


@login_required
def get_title_from_url(request: HttpRequest) -> JsonResponse:
    """Extract the title from a URL.

    Attempts to get the title from a URL by first checking if it exists
    as a bookmark in the system, and if not, parsing the title from
    the URL directly.

    Args:
        request: The HTTP request containing:
            - url: The URL to extract the title from (URL-encoded)

        Returns:
            JSON response containing:
                - status: "OK"
                - title: The extracted title, or None if extraction failed
                - bookmarkUuid: UUID of existing bookmark if found, None otherwise
                - message: Status message or error message
    """
    url = unquote(request.GET["url"])

    message = ""
    title = None
    bookmark_uuid = None

    user = cast(User, request.user)
    url_info = Bookmark.objects.filter(url=url, user=user)
    if url_info:
        title = url_info[0].name
        message = "Existing bookmark found in Bordercore."
        bookmark_uuid = url_info[0].uuid
    else:
        try:
            title = parse_title_from_url(url)[1]
        except Exception as e:
            return JsonResponse({"status": "ERROR", "message": str(e)})

    response = {
        "status": "OK",
        "title": title,
        "bookmarkUuid": bookmark_uuid,
        "message": message
    }

    return JsonResponse(response)


@login_required
def get_related_objects(request: HttpRequest, uuid: str) -> JsonResponse:
    """Get all related objects for a given question.

    Retrieves all objects (blobs, bookmarks, etc.) that are related
    to the specified question.

    Args:
        request: The HTTP request.
        uuid: The UUID of the question to get related objects for.

    Returns:
        JSON response containing:
            - status: "OK"
            - related_objects: List of related objects
    """

    user = cast(User, request.user)
    question = Question.objects.get(user=user, uuid=uuid)

    response = {
        "status": "OK",
        "related_objects": Blob.related_objects("drill", "QuestionToObject", question)
    }

    return JsonResponse(response)
