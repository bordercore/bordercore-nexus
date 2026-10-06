"""Private, versioned lessons and durable generation jobs."""

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

ACTIVE_STATUSES = ("queued", "generating")


class LessonVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    question = models.ForeignKey("drill.Question", null=True, on_delete=models.SET_NULL)
    question_uuid = models.UUIDField()
    created_at = models.DateTimeField(default=timezone.now)
    title = models.TextField()
    summary = models.TextField()
    html = models.TextField()
    source = models.JSONField()
    followups = models.JSONField()
    accuracy = models.JSONField(null=True, blank=True)
    provider = models.CharField(max_length=20)
    model = models.CharField(max_length=200)
    style = models.CharField(max_length=32, default="midnight-scholar")

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "question_uuid", "-created_at"])]


class LumenPreferences(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    provider = models.CharField(max_length=20, default="anthropic")
    model = models.CharField(max_length=200, default="claude-sonnet-5-5")


class GenerationJob(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    question = models.ForeignKey("drill.Question", null=True, on_delete=models.SET_NULL)
    question_uuid = models.UUIDField()
    source = models.JSONField()
    selected = models.JSONField()
    status = models.CharField(max_length=20, default="queued")
    message = models.TextField(default="Waiting to begin…")
    created_at = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(null=True)
    finished_at = models.DateTimeField(null=True)
    lease_expires_at = models.DateTimeField(null=True)
    lesson = models.OneToOneField(LessonVersion, null=True, on_delete=models.SET_NULL)
    review_lesson = models.ForeignKey(
        LessonVersion, null=True, on_delete=models.CASCADE, related_name="accuracy_jobs"
    )

    class Meta:
        indexes = [models.Index(fields=["status", "created_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "question_uuid"],
                condition=models.Q(status__in=ACTIVE_STATUSES),
                name="lumen_one_active_question_job",
            )
        ]
