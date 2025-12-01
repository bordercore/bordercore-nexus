"""
Models for the spaced-repetition "drill" system.

This module defines Question (a flashcard-style Q/A with spaced-repetition
metadata), relationships between questions and other Bordercore objects
(QuestionToObject), lightweight study session helpers, and utilities for
Elasticsearch indexing. It also defines QuestionResponse, which records a
user's self-reported difficulty rating for a review event.
"""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta
from typing import Any, Iterable, TypedDict, Union, cast

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models, transaction
from django.db.models import F, Max, Q, QuerySet
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.template.defaultfilters import pluralize
from django.urls import reverse
from django.utils import timezone

from blob.models import Blob
from bookmark.models import Bookmark
from lib.mixins import SortOrderMixin, TimeStampedModel
from search.services import delete_document, index_document
from tag.models import Tag

from .managers import DrillManager

log = logging.getLogger(f"bordercore.{__name__}")

INTERVALS_DEFAULT = [1, 2, 3, 5, 8, 13, 21, 30]


class IntervalResponse(TypedDict, total=False):
    """TypedDict representing an interval adjustment option.

    Keys:
        description: Human-readable HTML description of the interval change.
        interval: The new interval duration.
        interval_index: The index into the user's interval list.
    """

    description: str
    interval: timedelta
    interval_index: int


class Question(TimeStampedModel):
    """
    A single study item (question/answer pair) in the spaced-repetition system.

    Each Question tracks its review interval, last review time, difficulty
    adjustments, tags, and user ownership. It also supports linking itself to
    other Bordercore objects (Blob, Bookmark, etc.) via QuestionToObject.
    """

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    question = models.TextField()
    answer = models.TextField()
    tags = models.ManyToManyField(Tag, blank=True)
    last_reviewed = models.DateTimeField(null=True)
    times_failed = models.PositiveIntegerField(default=0, null=False)
    interval = models.DurationField(default=timedelta(days=1), blank=False, null=False)
    interval_index = models.PositiveIntegerField(default=0, null=False)
    is_favorite = models.BooleanField(default=False)
    is_reversible = models.BooleanField(default=False)
    is_disabled = models.BooleanField(default=False)
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    bc_objects = models.ManyToManyField(
        "drill.BCObject",
        through="drill.QuestionToObject",
        through_fields=("node", "bc_object"),
    )

    objects = DrillManager()

    def get_tags(self) -> str:
        """Return a comma-separated string of this question's tag names.

        Returns:
            Comma-separated human-readable list of tag names.
        """
        return ", ".join([tag.name for tag in self.tags.all()])

    def __str__(self) -> str:
        """Return string representation of the question.

        Returns:
            The text of the question field.
        """
        return self.question

    @property
    def needs_review(self) -> bool:
        """Return whether this question is due for review.

        A question needs review if it has never been reviewed, or if its current
        interval has fully elapsed since `last_reviewed`.

        Returns:
            True if the card should be shown to the user for review.
        """
        if not self.last_reviewed:
            return True
        return self.interval < timezone.now() - self.last_reviewed

    def _good_response(self) -> IntervalResponse:
        """Compute interval changes for a "good" response.

        "Good" means: I got it right with normal effort.

        Returns:
            IntervalResponse describing how the interval and index would change.
        """
        if self.interval_index + 1 < len(self.user.userprofile.drill_intervals):
            new_interval = timedelta(
                days=self.user.userprofile.drill_intervals[self.interval_index + 1]
            )
            return {
                "description": (
                    f"Increase interval to <strong>{new_interval.days} "
                    f"day{pluralize(new_interval.days)}</strong>"
                ),
                "interval": new_interval,
                "interval_index": self.interval_index + 1,
            }
        return {
            "description": (
                f"Interval stays at <strong>{self.interval.days} "
                f"day{pluralize(self.interval.days)}</strong>"
            ),
            "interval": self.interval,
            "interval_index": self.interval_index,
        }

    def _easy_response(self) -> IntervalResponse:
        """Compute interval changes for an "easy" response.

        "Easy" means: I knew it instantly.

        Behavior:
        - Normally, skip ahead two interval steps.
        - If skipping two would run off the end of the configured interval list,
          skip one (land on the last interval).

        Returns:
            IntervalResponse describing how the interval and index would change.
        """
        if self.interval_index + 1 == len(self.user.userprofile.drill_intervals):
            return {
                "description": (
                    f"Interval stays at <strong>{self.interval.days} "
                    f"day{pluralize(self.interval.days)}</strong>"
                ),
                "interval": self.interval,
                "interval_index": self.interval_index,
            }

        new_index = min(
            self.interval_index + 2,
            len(self.user.userprofile.drill_intervals) - 1,
        )
        new_interval = timedelta(days=self.user.userprofile.drill_intervals[new_index])
        return {
            "description": (
                f"Increase interval to <strong>{new_interval.days} "
                f"day{pluralize(new_interval.days)}</strong>"
            ),
            "interval": new_interval,
            "interval_index": new_index,
        }

    def _hard_response(self) -> IntervalResponse:
        """Compute interval changes for a "hard" response.

        "Hard" means: I struggled / barely got it.

        Behavior:
        - Generally step back two interval levels (but not below 0).
        - If already at the first level, keep index 0 and force interval=1 day.

        Returns:
            IntervalResponse describing how the interval and index would change.
        """
        if self.interval_index > 0:
            new_index = max(self.interval_index - 2, 0)
            new_interval = timedelta(
                days=self.user.userprofile.drill_intervals[new_index]
            )
            return {
                "description": (
                    f"Decrease interval to <strong>{new_interval.days} "
                    f"day{pluralize(new_interval.days)}</strong>"
                ),
                "interval": new_interval,
                "interval_index": new_index,
            }
        return {
            "description": (
                "Reset interval to <strong>1 day</strong>"
            ),
            "interval": timedelta(days=1),
            "interval_index": 0,
        }

    def get_intervals(
        self, description_only: bool = False
    ) -> dict[str, Union[IntervalResponse, dict[str, str]]]:
        """Return candidate interval adjustments for all response types.

        Args:
            description_only: If True, return only the "description" field for
                each response type. If False, return full interval metadata.

        Returns:
            A mapping keyed by response type:
            - "good"
            - "easy"
            - "hard"
            - "reset"
            Each value contains a description and (unless description_only=True)
            proposed interval/index values.
        """
        intervals: dict[str, IntervalResponse] = {
            "good": self._good_response(),
            "easy": self._easy_response(),
            "hard": self._hard_response(),
            "reset": {
                "description": "Reset interval to <strong>1 day</strong>",
                "interval": timedelta(days=1),
                "interval_index": 0,
            },
        }

        if description_only:
            return {
                outer_k: {
                    "description": outer_v["description"]
                }
                for outer_k, outer_v in intervals.items()
            }

        return cast(
            dict[str, Union[IntervalResponse, dict[str, str]]],
            intervals,
        )

    def record_response(self, response: str) -> None:
        """Record a user's self-reported review difficulty and update spacing.

        This updates interval, interval_index, and last_reviewed for the
        question, persists the changes, and also creates a QuestionResponse row.

        Args:
            response: One of "good", "easy", "hard", or "reset".
        """
        intervals = self.get_intervals()
        try:
            chosen = cast(IntervalResponse, intervals[response])
        except KeyError:
            raise ValueError(f"Invalid response value: {response}")

        self.interval = chosen["interval"]
        self.interval_index = chosen["interval_index"]
        self.last_reviewed = timezone.now()
        self.save()

        response_obj = QuestionResponse(question=self, response=response)
        response_obj.save()

    def get_last_response(self) -> QuestionResponse | None:
        """Return the most recent QuestionResponse for this Question.

        Returns:
            The latest QuestionResponse instance, or None if there are no
            responses recorded.
        """
        return (
            QuestionResponse.objects.filter(question=self)
            .order_by("-date")
            .first()
        )

    def get_all_tags_progress(self) -> list[dict[str, Union[str, int]]]:
        """Return review/progress summaries for each tag on this question.

        For each tag the question has, this calls `get_tag_progress(...)` and
        returns the list of those progress dicts.

        Returns:
            A list of tag progress dicts. Each dict includes fields such as
            "name", "progress", "last_reviewed", and "count".
        """
        info: list[dict[str, Union[str, int]]] = []
        for tag in self.tags.all():
            info.append(Question.get_tag_progress(self.user, tag.name))
        return info

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Save the question.

        This method currently just forwards to the superclass `save()`.

        Args:
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.
        """
        super().save(*args, **kwargs)

    def delete(
            self,
            using: Any | None = None,
            keep_parents: bool = False,
    ) -> tuple[int, dict[str, int]]:
        """Delete this question and remove it from Elasticsearch."""
        question_uuid = str(self.uuid)
        result = super().delete(using=using, keep_parents=keep_parents)

        def cleanup() -> None:
            try:
                delete_document(question_uuid)
            except Exception as e:
                log.error("Failed to delete question %s from Elasticsearch: %s", question_uuid, e)

        transaction.on_commit(cleanup)
        return result

    def index_question(self) -> None:
        """Index this question in Elasticsearch.
        """
        index_document(self.elasticsearch_document)

    def add_related_object(self, object_uuid: str) -> dict[str, str]:
        """Relate this Question to a Blob or Bookmark by UUID.

        The method checks for a Blob with the given UUID, then a Bookmark.
        If found, it creates a `QuestionToObject` link unless one already
        exists.

        Args:
            object_uuid: The UUID (as a string) of either a Blob or Bookmark.

        Returns:
            A dict with:
            - "status": "OK" on success, "Error" otherwise.
            - "message": Present only on error (e.g. already related, not found).
        """
        blob_instance: Blob | None = Blob.objects.filter(
            uuid=object_uuid
        ).first()
        if blob_instance:
            related_kwargs: dict[str, Any] = {"blob": blob_instance}
        else:
            bookmark_instance: Bookmark | None = Bookmark.objects.filter(
                uuid=object_uuid
            ).first()
            if bookmark_instance:
                related_kwargs = {"bookmark": bookmark_instance}
            else:
                return {
                    "status": "Error",
                    "message": "Related Blob or Bookmark not found",
                }

        if QuestionToObject.objects.filter(node=self, **related_kwargs).exists():
            return {
                "status": "Error",
                "message": "That object is already related",
            }

        QuestionToObject.objects.create(node=self, **related_kwargs)
        return {"status": "OK"}

    @property
    def sql_db(self) -> QuestionToObject | None:
        """Return the first related QuestionToObject marked as 'sql'.

        Returns:
            The first QuestionToObject whose note == "sql", or None if not found.
        """
        return (
            QuestionToObject.objects.filter(node=self, note="sql").first()
        )

    @property
    def elasticsearch_document(self) -> dict[str, Any]:
        """Return a representation of the question suitable for indexing in Elasticsearch.

        Returns:
            Dictionary containing the question data formatted for Elasticsearch for indexing.
        """
        doc: dict[str, Any] = {
            "_index": settings.ELASTICSEARCH_INDEX,
            "_id": self.uuid,
            "_source": {
                "uuid": self.uuid,
                "bordercore_id": self.id,
                "question": self.question,
                "answer": self.answer,
                "tags": [tag.name for tag in self.tags.all()],
                "importance": 10 if self.is_favorite else 1,
                "last_modified": self.modified,
                "doctype": "drill",
                "date": {
                    "gte": self.created.strftime("%Y-%m-%d %H:%M:%S"),
                    "lte": self.created.strftime("%Y-%m-%d %H:%M:%S"),
                },
                "date_unixtime": self.created.strftime("%s"),
                "user_id": self.user.id,
                **settings.ELASTICSEARCH_EXTRA_FIELDS,
            },
        }

        if self.last_reviewed:
            doc["_source"]["last_reviewed"] = self.last_reviewed.strftime("%s")

        return doc

    @staticmethod
    def start_study_session(
        user: User,
        session: dict[str, Any],
        study_type: str,
        question_filter: str = "review",
        params: dict[str, Any] | None = None,
    ) -> str | None:
        """Create/initialize a study session and return the first question UUID.

        Depending on `study_type`, we build a queryset of questions (favorites,
        recent, tag, keyword, random, etc.), apply muted-tag filtering and
        "needs review" logic, then stash session metadata in ``session`` under
        ``"drill_study_session"``.

        Args:
            user: The owner of the questions.
            session: The caller's session dict (e.g. request.session).
            study_type: The type of drill the user wants:
                "favorites", "recent", "tag", "keyword", "random", or default.
            filter: Optional extra filter logic. If "review", restrict to
                questions currently due.
            params: Extra parameters:
                - "interval" (for "recent")
                - "tags" (for "tag")
                - "keyword" (for "keyword")
                - "count" (for "random")

        Returns:
            The UUID (as string) of the first selected question, or None if no
            questions matched.
        """
        params = params or {}

        questions: QuerySet[Question] = Question.objects.filter(user=user, is_disabled=False)

        if study_type == "favorites":
            questions = questions.filter(is_favorite=True)
        elif study_type == "recent":
            # params["interval"] is expected to be an int-like string (days)
            questions = questions.filter(
                created__gte=timezone.now()
                - timedelta(days=int(params.get("interval", 7)))
            )
        elif study_type == "tag":
            tags_param = params.get("tags", "")
            tag_names = [t.strip() for t in str(tags_param).split(",") if t.strip()]
            for tag_name in tag_names:
                questions = questions.filter(tags__name=tag_name)
        elif study_type == "keyword":
            questions = questions.filter(
                Q(question__icontains=params.get("keyword", ""))
                | Q(answer__icontains=params.get("keyword", "")),
            )

        if question_filter == "review":
            questions = questions.filter(
                Q(interval__lte=timezone.now() - F("last_reviewed"))  # type: ignore[operator]
                | Q(last_reviewed__isnull=True)
            )

        drill_tags_muted = user.userprofile.drill_tags_muted.all()
        questions = questions.exclude(tags__in=drill_tags_muted)

        uuid_rows_raw = questions.order_by("?").values("uuid")

        # Tell mypy explicitly: this is an iterable of dict-like rows.
        uuid_rows_iter = cast(Iterable[dict[str, Any]], uuid_rows_raw)

        uuid_rows: list[dict[str, Any]] = list(uuid_rows_iter)

        if study_type == "random":
            count = int(params.get("count", 10))
            uuid_rows = uuid_rows[:count]

        if uuid_rows:
            session["drill_study_session"] = {
                "type": study_type,
                "current": str(uuid_rows[0]["uuid"]),
                "list": [str(x["uuid"]) for x in uuid_rows],
                "tag": params.get("tags", None),
                "search_term": params,
            }
            return session["drill_study_session"]["current"]
        return None

    @staticmethod
    def get_study_session_progress(session: dict[str, Any]) -> int:
        """Return the index position of the current card in the study session.

        Args:
            session: The caller's (mutable) session dict.

        Returns:
            An integer index into the session's "list" array. Returns 0 if
            there is no active "drill_study_session".
        """
        if "drill_study_session" in session:
            return session["drill_study_session"]["list"].index(
                session["drill_study_session"]["current"]
            )
        return 0

    @staticmethod
    def get_tag_progress(
        user: User, tag: str
    ) -> dict[str, Union[str, int]]:
        """Return study progress metrics for all Questions with a given tag.

        For all questions owned by ``user`` that have the tag named ``tag``,
        compute:
        - total number of such questions,
        - how many are currently "todo" (due for review),
        - when any of them was last reviewed,
        - % complete (already-reviewed) progress,
        - URL to start a study session for that tag.

        Args:
            user: The User whose questions we're inspecting.
            tag: The tag name to summarize.

        Returns:
            A dict containing:
            - "name": Tag name.
            - "progress": Integer percent (0-100).
            - "last_reviewed": Most recent review date string ("Month DD, YYYY")
              or "Never".
            - "url": Drill URL to study this tag.
            - "count": Total number of tagged questions.
        """
        count = (
            Question.objects.filter(user=user)
            .filter(tags__name=tag)
            .count()
        )

        todo = (
            Question.objects.filter(Q(user=user), Q(tags__name=tag))
            .filter(
                Q(interval__lte=timezone.now() - F("last_reviewed"))  # type: ignore[operator]
                | Q(last_reviewed__isnull=True)
            )
            .count()
        )

        last_reviewed_qs = (
            Tag.objects.filter(user=user, name=tag)
            .annotate(last_reviewed=Max("question__last_reviewed"))
            .first()
        )

        if last_reviewed_qs and last_reviewed_qs.last_reviewed:
            last_reviewed_str: str = last_reviewed_qs.last_reviewed.strftime(
                "%B %d, %Y"
            )
        else:
            last_reviewed_str = "Never"

        progress = round(100 - (todo / count * 100)) if count != 0 else 0

        return {
            "name": tag,
            "progress": progress,
            "last_reviewed": last_reviewed_str,
            "url": reverse("drill:start_study_session")
            + f"?study_method=tag&tags={tag}",
            "count": count,
        }


class QuestionResponse(models.Model):
    """A single recorded self-report for a Question review.

    Each time the user reviews a Question and labels it "easy/good/hard/etc.",
    we store that label as one QuestionResponse row.

    Attributes:
        question: ForeignKey to the Question being reviewed.
        response: The user's difficulty judgment.
        date: Timestamp when the response was captured.
    """

    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    response = models.TextField(blank=False, null=False)
    date = models.DateTimeField(auto_now_add=True)


class QuestionToObject(SortOrderMixin):
    """Join/association between a Question and another object (Blob, Bookmark).

    This model is the through-table for many-to-many style relationships
    between Questions and arbitrary "BCObject" entities (Blob, Bookmark, etc.).

    Attributes:
        uuid: Stable UUID for this relationship row.
        node: The Question this relationship belongs to.
        blob: Optional Blob related to the Question.
        bookmark: Optional Bookmark related to the Question.
        question: Optional additional Question link.
        bc_object: Generic BCObject reference.
        note: Free-form text annotation.
        sort_order: (inherited from SortOrderMixin) used for ordering.
    """

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    node = models.ForeignKey(
        "drill.Question",
        null=False,
        on_delete=models.CASCADE,
        related_name="nodes",
    )
    blob = models.ForeignKey("blob.Blob", null=True, on_delete=models.CASCADE)
    bookmark = models.ForeignKey(
        "bookmark.Bookmark", null=True, on_delete=models.CASCADE
    )
    question = models.ForeignKey(
        "drill.Question", null=True, on_delete=models.CASCADE
    )
    bc_object = models.ForeignKey(
        "drill.BCObject", on_delete=models.CASCADE, null=True
    )
    note = models.TextField(blank=True, null=True)

    field_name = "node"

    class Meta:
        ordering = ("sort_order",)
        constraints = [
            models.UniqueConstraint(fields=("node", "blob"), name="uniq_node_blob"),
            models.UniqueConstraint(fields=("node", "bookmark"), name="uniq_node_bookmark"),
            models.UniqueConstraint(fields=("node", "question"), name="uniq_node_question"),
        ]

    def __str__(self) -> str:
        """Return the string representation of this relationship.

        Returns:
            A string describing which object this Question is linked to.
        """
        if self.blob:
            return f"{self.node} -> {self.blob}"
        if self.bookmark:
            return f"{self.node} -> {self.bookmark}"
        return f"{self.node} -> {self.question}"


class BCObject(TimeStampedModel):
    """Generic related object wrapper.

    This is a minimal model used to attach arbitrary objects to Questions via
    QuestionToObject. It inherits timestamp fields from TimeStampedModel.

    Attributes:
        uuid: Stable identifier for this object.
    """

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)


@receiver(pre_delete, sender=QuestionToObject)
def remove_relationship(
    sender: type[QuestionToObject],
    instance: QuestionToObject,
    **kwargs: Any,
) -> None:
    """Signal handler to clean up a QuestionToObject before deletion.

    This delegates to the instance's `handle_delete()` so that any extra
    teardown logic (e.g. removing sort orders, unlinking files) runs.

    Args:
        sender: The model class (QuestionToObject).
        instance: The QuestionToObject instance being deleted.
        **kwargs: Additional signal metadata (unused).
    """
    instance.handle_delete()
