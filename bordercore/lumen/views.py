"""Authenticated library endpoints; generated documents remain sandboxed."""

from functools import wraps
from typing import Any, Callable, cast
from uuid import UUID

from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.db.models import Q, Subquery
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET

from . import generation, services
from .models import ACTIVE_STATUSES, GenerationJob, LessonVersion, LumenPreferences
from .themes import themed_html


def endpoint(methods: list[str]) -> Callable[..., Any]:
    def decorate(func: Callable[..., Response]) -> Callable[..., Any]:
        @api_view(methods)
        @wraps(func)
        def wrapped(request: Request, *args: Any, **kwargs: Any) -> Response:
            try:
                response = func(request, *args, **kwargs)
            except generation.UserError as exc:
                response = Response({"detail": str(exc)}, status=exc.status)
            response["Cache-Control"] = "private, no-store"
            return response

        return wrapped

    return decorate


@login_required
@ensure_csrf_cookie
@require_GET
def index(request: HttpRequest) -> HttpResponse:
    return render(
        request,
        "lumen/index.html",
        {
            "title": "Lumen",
            "lumen_config": {
                "storageKey": f"lumen-jobs-{request.user.pk}",
                "api": reverse("lumen:index") + "api/",
                "prefsUrl": reverse("accounts:prefs"),
            },
        },
    )


def lesson_summary(lesson: LessonVersion) -> dict[str, Any]:
    return {
        "id": str(lesson.pk),
        "question_uuid": str(lesson.question_uuid),
        "title": lesson.title,
        "summary": lesson.summary,
        "created_at": lesson.created_at.isoformat(),
        "provider": lesson.provider,
        "model": lesson.model,
    }


@endpoint(["GET"])
def library(request: Request) -> Response:
    # Select the latest version first, so a matching old title doesn't duplicate questions.
    latest = (
        LessonVersion.objects.filter(user=request.user)
        .order_by("question_uuid", "-created_at", "-id")
        .distinct("question_uuid")
        .values("id")
    )
    lessons = LessonVersion.objects.filter(pk__in=Subquery(latest)).defer(
        "html", "source", "followups"
    )
    query = request.query_params.get("q", "").strip()[:200]
    if query:
        match = Q(title__icontains=query) | Q(summary__icontains=query)
        try:
            match |= Q(question_uuid=generation.canonical_uuid(query))
        except generation.UserError:
            pass
        lessons = lessons.filter(match)
    try:
        page = max(1, int(request.query_params.get("page", 1)))
    except ValueError:
        raise generation.UserError("Invalid page.")
    count = lessons.count()
    start = (page - 1) * 24
    return Response(
        {
            "lessons": [lesson_summary(x) for x in lessons[start : start + 24]],
            "count": count,
            "page": page,
            "has_next": start + 24 < count,
        }
    )


@endpoint(["GET"])
def versions(request: Request, question_uuid: UUID) -> Response:
    rows = LessonVersion.objects.filter(
        user=request.user, question_uuid=question_uuid
    ).defer("html", "source", "followups")
    return Response({"versions": [lesson_summary(x) for x in rows]})


@endpoint(["GET"])
def detail(request: Request, lesson_id: UUID) -> Response:
    lesson = get_object_or_404(
        LessonVersion.objects.select_related("question"),
        user=request.user,
        pk=lesson_id,
    )
    question = lesson.question
    return Response(
        {
            **lesson_summary(lesson),
            "source": lesson.source,
            "followups": lesson.followups,
            "accuracy": lesson.accuracy,
            "correction_applied": bool(
                question
                and lesson.accuracy
                and lesson.accuracy.get("status") == "issues"
                and {"question": question.question, "answer": question.answer}
                == {key: lesson.accuracy.get(key) for key in ("question", "answer")}
            ),
            "can_regenerate": question is not None
            and question.user_id == request.user.id,
            "source_changed": question is not None
            and lesson.source
            != {"question": question.question, "answer": question.answer},
            "html_url": reverse("lumen:html", args=[lesson.pk]),
        }
    )


@login_required
@require_GET
@xframe_options_sameorigin
def lesson_html(request: HttpRequest, lesson_id: UUID) -> HttpResponse:
    lesson = get_object_or_404(LessonVersion, user=request.user, pk=lesson_id)
    response = HttpResponse(
        themed_html(lesson.html, cast(User, request.user).userprofile.lumen_theme),
        content_type="text/html; charset=utf-8",
    )
    response["Content-Security-Policy"] = (
        generation.CSP + "; sandbox allow-scripts; frame-ancestors 'self'"
    )
    response["X-Content-Type-Options"] = "nosniff"
    response["Referrer-Policy"] = "no-referrer"
    response["Cache-Control"] = "private, no-store"
    if request.GET.get("download") == "1":
        response["Content-Disposition"] = (
            f'attachment; filename="lumen-{lesson.question_uuid}-{str(lesson.id)[:8]}.html"'
        )
    return response


@endpoint(["GET", "PUT"])
def preferences(request: Request) -> Response:
    if request.method == "PUT":
        value = services.validate_preferences(request.data)
        LumenPreferences.objects.update_or_create(user=request.user, defaults=value)
    return Response(
        {
            "settings": services.selected_settings(request.user),
            "enabled": settings.LUMEN_GENERATION_ENABLED,
            "providers": {
                key: {
                    "label": value["label"],
                    "configured": bool(generation.api_key(key)),
                }
                for key, value in generation.PROVIDERS.items()
            },
        }
    )


@endpoint(["GET"])
def models(request: Request, provider: str) -> Response:
    return Response(generation.model_catalog(provider))


@endpoint(["POST"])
def generate(request: Request) -> Response:
    if not isinstance(request.data, dict):
        raise generation.UserError("Expected a JSON object.")
    job = services.enqueue(request.user, request.data.get("uuid"))
    return Response({"job_id": str(job.pk)}, status=202)


def job_data(job: GenerationJob) -> dict[str, Any]:
    return {
        "id": str(job.pk),
        "question_uuid": str(job.question_uuid),
        "status": job.status,
        "message": job.message,
        "lesson_id": str(job.lesson_id or job.review_lesson_id)
        if (job.lesson_id or job.review_lesson_id)
        else None,
    }


@endpoint(["GET"])
def jobs(request: Request) -> Response:
    return Response(
        {
            "jobs": [
                job_data(job)
                for job in GenerationJob.objects.filter(
                    user=request.user, status__in=ACTIVE_STATUSES
                ).order_by("created_at")
            ]
        }
    )


@endpoint(["GET"])
def job_status(request: Request, job_id: UUID) -> Response:
    return Response(
        job_data(get_object_or_404(GenerationJob, user=request.user, pk=job_id))
    )


@endpoint(["POST"])
def check_accuracy(request: Request, lesson_id: UUID) -> Response:
    lesson = get_object_or_404(LessonVersion, pk=lesson_id, user=request.user)
    if lesson.question_id is None:
        raise generation.UserError("The original question no longer exists.", 404)
    job = services.enqueue(
        request.user, str(lesson.question_uuid), review_lesson=lesson
    )
    return Response({"job_id": str(job.pk)}, status=202)


@endpoint(["POST"])
def correct_source(request: Request, lesson_id: UUID) -> Response:
    services.apply_correction(request.user, lesson_id)
    return Response({"detail": "Original question and answer corrected."})
