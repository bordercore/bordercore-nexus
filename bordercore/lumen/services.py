"""Transactional queue: web processes enqueue, a supervised process generates."""

import logging
import re
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.contrib.auth.models import User
from django.db import connection, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from drill.models import Question

from . import generation
from .generation import UserError
from .models import ACTIVE_STATUSES, GenerationJob, LessonVersion, LumenPreferences

log = logging.getLogger(__name__)
# Transaction-scoped PostgreSQL advisory lock serializes the small global queue.
QUEUE_LOCK = 1684820197


def selected_settings(user: User) -> dict[str, str]:
    prefs = LumenPreferences.objects.filter(user=user).first()
    return {
        "provider": prefs.provider if prefs else "anthropic",
        "model": prefs.model if prefs else "claude-sonnet-5-5",
        "style": user.userprofile.lumen_theme,
    }


def validate_preferences(value: Any) -> dict[str, str]:
    if (
        not isinstance(value, dict)
        or not isinstance(value.get("provider"), str)
        or value["provider"] not in generation.PROVIDERS
    ):
        raise UserError("Choose Anthropic, OpenAI, or OpenRouter.")
    model = value.get("model")
    if not isinstance(model, str) or not re.fullmatch(
        r"[A-Za-z0-9][A-Za-z0-9._:/+@-]{0,199}", model
    ):
        raise UserError("Enter a valid model ID.")
    return {"provider": value["provider"], "model": model}


def expire_jobs() -> int:
    """Never automatically replay an API call whose billing outcome is unknown."""
    return GenerationJob.objects.filter(
        status="generating", lease_expires_at__lt=timezone.now()
    ).update(
        status="error",
        message="Generation was interrupted or timed out. Please retry.",
        finished_at=timezone.now(),
    )


@transaction.atomic
def enqueue(
    user: User, question_uuid: Any, *, review_lesson: LessonVersion | None = None
) -> GenerationJob:
    question_uuid = generation.canonical_uuid(question_uuid)
    question = get_object_or_404(Question, user=user, uuid=question_uuid)
    if review_lesson is not None:
        if review_lesson.user_id != user.pk or review_lesson.question_id != question.pk:
            raise UserError("Lesson not found.", 404)
        if review_lesson.accuracy is not None:
            raise UserError("This lesson already has an accuracy assessment.", 409)
        if review_lesson.source != {
            "question": question.question,
            "answer": question.answer,
        }:
            raise UserError(
                "The original drill has changed. Regenerate the lesson before checking accuracy.",
                409,
            )
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [QUEUE_LOCK])
    expire_jobs()
    active = GenerationJob.objects.filter(
        user=user, question_uuid=question_uuid, status__in=ACTIVE_STATUSES
    ).first()
    if active:
        if active.review_lesson_id != (review_lesson.pk if review_lesson else None):
            raise UserError(
                "Another job is already running for this question. Please wait for it to finish.",
                409,
            )
        return active
    if not settings.LUMEN_GENERATION_ENABLED:
        raise UserError("Lesson generation is currently disabled.", 503)
    if (
        GenerationJob.objects.filter(status__in=ACTIVE_STATUSES).count()
        >= settings.LUMEN_QUEUE_LIMIT
    ):
        raise UserError("The generation queue is full. Please try again later.", 429)
    selected = selected_settings(user)
    if not generation.api_key(selected["provider"]):
        raise UserError("The selected provider has no server API key configured.", 503)
    if not question.question.strip() or not question.answer.strip():
        raise UserError("The question and answer must both contain text.")
    return GenerationJob.objects.create(
        user=user,
        question=question,
        question_uuid=question.uuid,
        source={"question": question.question, "answer": question.answer},
        selected=selected,
        review_lesson=review_lesson,
    )


@transaction.atomic
def claim_job() -> GenerationJob | None:
    expire_jobs()
    if not settings.LUMEN_GENERATION_ENABLED:
        return None
    job = (
        GenerationJob.objects.select_for_update(skip_locked=True)
        .filter(status="queued")
        .order_by("created_at")
        .first()
    )
    if job:
        now = timezone.now()
        job.status = "generating"
        job.message = (
            "Checking the original question and answer…"
            if job.review_lesson_id
            else "Designing your interactive lesson…"
        )
        job.started_at = now
        # Fixed lease exceeds the provider timeout; no heartbeat thread or open transaction
        # is needed while waiting for the upstream response.
        job.lease_expires_at = now + timedelta(
            seconds=settings.LUMEN_JOB_TIMEOUT_SECONDS
        )
        job.save(update_fields=["status", "message", "started_at", "lease_expires_at"])
    return job


def run_job(job: GenerationJob) -> None:
    try:
        if job.review_lesson_id:
            accuracy = generation.generate_accuracy(job.source, job.selected)
        else:
            payload = generation.parse_lesson(
                generation.generate(job.source, job.selected)
            )
            html = generation.assemble_html(payload, job.source)
        with transaction.atomic():
            current = GenerationJob.objects.select_for_update().get(pk=job.pk)
            if (
                current.status != "generating"
                or current.lease_expires_at is None
                or current.lease_expires_at < timezone.now()
            ):
                if current.status == "generating":
                    current.status = "error"
                    current.message = "Generation timed out. Please retry."
                    current.finished_at = timezone.now()
                    current.save(update_fields=["status", "message", "finished_at"])
                return
            if current.review_lesson_id:
                updated = LessonVersion.objects.filter(
                    pk=current.review_lesson_id,
                    user_id=current.user_id,
                    accuracy__isnull=True,
                ).update(accuracy=accuracy)
                if not updated:
                    raise UserError(
                        "The lesson assessment has already changed. Refresh the page.",
                        409,
                    )
            else:
                lesson = LessonVersion.objects.create(
                    user_id=current.user_id,
                    question_id=current.question_id,
                    question_uuid=current.question_uuid,
                    source=current.source,
                    followups=payload["followups"],
                    accuracy=payload["accuracy"],
                    title=payload["title"],
                    summary=payload["summary"],
                    html=html,
                    **current.selected,
                )
                current.lesson = lesson
            current.status = "complete"
            current.message = (
                "Accuracy check complete."
                if current.review_lesson_id
                else "Your lesson is ready."
            )
            current.finished_at = timezone.now()
            current.save(update_fields=["lesson", "status", "message", "finished_at"])
    except Exception as exc:
        # Do not log provider response bodies, credentials, or private lesson source.
        log.warning("Lumen job %s failed (%s)", job.pk, type(exc).__name__)
        message = (
            str(exc)
            if isinstance(exc, UserError)
            else "Generation failed. Please retry or choose another model."
        )
        GenerationJob.objects.filter(pk=job.pk, status="generating").update(
            status="error", message=message, finished_at=timezone.now()
        )


@transaction.atomic
def apply_correction(user: User, lesson_id: Any) -> None:
    """Apply only the stored proposal, atomically checking the original source."""
    lesson = get_object_or_404(LessonVersion, pk=lesson_id, user=user)
    if lesson.accuracy is None:
        raise UserError("Check accuracy before applying a correction.", 400)
    accuracy = generation.validate_accuracy(lesson.accuracy)
    if accuracy["status"] != "issues":
        raise UserError("This lesson has no factual correction to apply.", 400)
    question = get_object_or_404(
        Question.objects.select_for_update(), pk=lesson.question_id, user=user
    )
    proposed = {key: accuracy[key] for key in ("question", "answer")}
    current = {"question": question.question, "answer": question.answer}
    if current == proposed:
        return  # Repeated clicks are idempotent.
    if current != lesson.source:
        raise UserError(
            "The original drill has changed since this lesson was created. Regenerate the lesson before applying a correction.",
            409,
        )
    question.question = proposed["question"]
    question.answer = proposed["answer"]
    question.save(update_fields=["question", "answer", "modified"])
    question.index_question()
