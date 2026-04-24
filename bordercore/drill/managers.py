"""Custom manager for drill questions and tag-related queries.

This module provides DrillManager, a Django manager extension that adds
custom queryset methods for querying drill questions, calculating progress
metrics, and retrieving tag-related information for the spaced repetition
drill system.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from django.apps import apps
from django.contrib.auth.models import User
from django.db import models
from django.db.models import Count, DateTimeField, ExpressionWrapper, F, Max, Min, Q, QuerySet
from django.db.models.functions import TruncDate, TruncWeek
from django.urls import reverse
from django.utils import timezone

from tag.models import Tag


class DrillManager(models.Manager):
    """Custom manager for drill question queries and progress calculations.

    This manager extends Django's base Manager to provide methods for:
    - Querying tags by review status
    - Calculating progress metrics for tags and favorite questions
    - Retrieving random, pinned, and disabled tags
    - Finding recently used tags

    All methods operate in the context of a specific user and respect
    user preferences such as muted tags and pinned tags.
    """

    def tags_last_reviewed(self, user: User) -> QuerySet[Tag]:
        """Return tags which haven't been reviewed in a while.

        Args:
            user: The user to get tags for.

        Returns:
            Tags ordered by last reviewed date (nulls first).
        """

        return Tag.objects.only("id", "name") \
                          .filter(user=user, question__isnull=False) \
                          .exclude(pk__in=user.userprofile.drill_tags_muted.all()) \
                          .annotate(last_reviewed=Max("question__last_reviewed")) \
                          .order_by(F("last_reviewed").asc(nulls_first=True))

    def tags_needing_review(self, user: User) -> list[dict[str, Any]]:
        """Return tag-progress rows for tags with at least one due question.

        Tags whose questions are all disabled are excluded; muted tags are
        excluded. Results are sorted by the most recent review date ascending
        (oldest-recent-review first), so tags overdue the longest appear first.

        Note: progress/count numbers in each row come from
        ``_batch_tag_progress`` and currently include disabled questions in
        their counts (matching the rest of the manager's behaviour).

        Args:
            user: The user whose tags to inspect.

        Returns:
            List of tag progress dicts (as produced by ``_batch_tag_progress``),
            filtered to rows where ``todo > 0``.
        """
        tags = (
            Tag.objects.filter(
                user=user,
                question__isnull=False,
                question__is_disabled=False,
            )
            .exclude(pk__in=user.userprofile.drill_tags_muted.all())
            .annotate(last_reviewed=Max("question__last_reviewed"))
            .order_by(F("last_reviewed").asc(nulls_first=True))
            .distinct()
            .values_list("name", flat=True)
        )
        rows = self._batch_tag_progress(user, list(tags))
        return [r for r in rows if r["todo"] > 0]

    def total_tag_progress(self, user: User) -> dict[str, float | int]:
        """Get percentage of all tags not needing review.

        Args:
            user: The user to calculate progress for.

        Returns:
            Dictionary with 'percentage' and 'count' keys. 'percentage'
            is the percentage of tags not needing review, 'count' is the
            number of questions needing review.
        """

        Question = apps.get_model("drill", "Question")

        count = Question.objects.filter(user=user).count()

        muted_tags = user.userprofile.drill_tags_muted.all()

        todo = Question.objects.filter(
            Q(user=user),
            Q(interval__lte=timezone.now() - F("last_reviewed"))  # type: ignore[operator]
            | Q(last_reviewed__isnull=True),
            Q(is_disabled=False)
        ).exclude(tags__in=muted_tags).count()

        percentage = 100 - (todo / count * 100) if count > 0 else 0

        return {
            "percentage": percentage,
            "count": todo
        }

    def favorite_questions_progress(self, user: User) -> dict[str, float | int]:
        """Get percentage of favorite questions not needing review.

        Args:
            user: The user to calculate progress for.

        Returns:
            Dictionary with 'percentage' and 'count' keys. 'percentage'
            is the percentage of favorite questions not needing review,
            'count' is the total number of favorite questions.
        """

        Question = apps.get_model("drill", "Question")

        count = Question.objects.filter(user=user, is_favorite=True).count()

        todo = Question.objects.filter(
            Q(user=user),
            Q(is_favorite=True),
            Q(interval__lte=timezone.now() - F("last_reviewed"))  # type: ignore[operator]
            | Q(last_reviewed__isnull=True)
        ).count()

        percentage = 100 - (todo / count * 100) if count > 0 else 0

        return {
            "percentage": percentage,
            "count": count
        }

    def get_random_tag(self, user: User) -> dict[str, str | int] | None:
        """Get a random tag and its related information.

        We don't want a simple "order by random" on the entire tag set,
        since that will bias selections for popular tags. So we use
        a subquery to get the distinct tags first, then choose
        a random tag from that set.

        Args:
            user: The user to get a random tag for.

        Returns:
            Tag progress information for a random tag, or None if no tags
            are available.
        """

        Question = apps.get_model("drill", "Question")

        distinct_tags = Tag.objects.filter(question__isnull=False, user=user).distinct("name")
        random_tag = Tag.objects.filter(id__in=distinct_tags).order_by("?").first()
        return Question.get_tag_progress(user, random_tag.name) if random_tag else None

    def get_pinned_tags(self, user: User) -> list[dict[str, str | int]]:
        """Get the user's pinned tags.

        Args:
            user: The user to get pinned tags for.

        Returns:
            List of tag progress information dictionaries for pinned tags.
        """
        tags = user.userprofile.pinned_drill_tags.all().only("name").order_by("drilltag__sort_order")
        tag_names = [t.name for t in tags]
        return self._batch_tag_progress(user, tag_names)

    def get_disabled_tags(self, user: User) -> list[dict[str, str | int]]:
        """Get the user's disabled tags.

        Args:
            user: The user to get disabled tags for.

        Returns:
            List of tag progress information dictionaries for disabled tags.
        """
        Question = apps.get_model("drill", "Question")

        tag_ids = Question.objects.filter(
            is_disabled=True, user=user
        ).values_list("tags", flat=True)
        tag_names = list(
            Tag.objects.filter(id__in=tag_ids).distinct().values_list("name", flat=True)
        )
        return self._batch_tag_progress(user, tag_names)

    def recent_tags(self, user: User) -> Any:
        """Get the tags most recently attached to questions.

        Args:
            user: The user to get recent tags for.

        Returns:
            Tags ordered by most recently created, annotated with the maximum
            creation date.
        """

        Question = apps.get_model("drill", "Question")

        return Question.objects.filter(user=user).values(
            name=F("tags__name")
        ).annotate(
            max=Max("created")
        ).order_by(
            "-max"
        )

    def next_due_in(self, user: User) -> str | None:
        """Humanized time until the next question becomes due.

        Args:
            user: The user whose schedule to inspect.

        Returns:
            Strings like ``"in 02h 14m"``, ``"in 5d"``, or ``"due now"``;
            ``None`` if the user has no scheduled (non-disabled, reviewed)
            questions.
        """
        Question = apps.get_model("drill", "Question")
        qs = Question.objects.filter(
            user=user, is_disabled=False, last_reviewed__isnull=False
        )
        next_due = qs.annotate(
            due_at=F("last_reviewed") + F("interval"),
        ).aggregate(soonest=Min("due_at"))["soonest"]
        if next_due is None:
            return None
        delta = next_due - timezone.now()
        seconds = int(delta.total_seconds())
        if seconds <= 0:
            return "due now"
        hours, remainder = divmod(seconds, 3600)
        minutes = remainder // 60
        if hours >= 24:
            return f"in {hours // 24}d"
        return f"in {hours:02d}h {minutes:02d}m"

    def reviewed_count(self, user: User, since: datetime) -> int:
        """Count QuestionResponse rows for ``user`` since the given datetime.

        Args:
            user: The user whose responses to count.
            since: Lower-bound datetime (inclusive).

        Returns:
            Number of responses recorded at or after ``since``.
        """
        QuestionResponse = apps.get_model("drill", "QuestionResponse")
        return QuestionResponse.objects.filter(
            question__user=user, date__gte=since
        ).count()

    def study_streak(self, user: User) -> int:
        """Number of consecutive days (ending today) with at least one response.

        Args:
            user: The user whose streak to compute.

        Returns:
            Integer count of consecutive days ending at today; 0 if no
            response was recorded today.
        """
        QuestionResponse = apps.get_model("drill", "QuestionResponse")
        today = timezone.localdate()
        days_with_any = set(
            QuestionResponse.objects.filter(question__user=user)
            .annotate(d=TruncDate("date"))
            .values_list("d", flat=True)
            .distinct()
        )
        streak = 0
        cursor = today
        while cursor in days_with_any:
            streak += 1
            cursor -= timedelta(days=1)
        return streak

    def featured_tag_histogram(
        self, tag: str, user: User, weeks: int = 12
    ) -> list[int]:
        """Per-week QuestionResponse counts for ``tag`` over the last ``weeks`` weeks.

        Args:
            tag: Tag name.
            user: The user whose responses to count.
            weeks: Number of trailing weeks to include.

        Returns:
            List of ``weeks`` integers, oldest first; each is the number of
            QuestionResponse rows in that week for questions tagged ``tag``.
        """
        QuestionResponse = apps.get_model("drill", "QuestionResponse")
        today = timezone.localdate()
        start_monday = today - timedelta(days=today.weekday() + 7 * (weeks - 1))
        rows = (
            QuestionResponse.objects.filter(
                question__user=user,
                question__tags__name=tag,
                date__date__gte=start_monday,
            )
            .annotate(week_start=TruncWeek("date"))
            .values("week_start")
            .annotate(n=Count("id"))
        )
        by_week = {r["week_start"].date(): r["n"] for r in rows}
        return [by_week.get(start_monday + timedelta(weeks=i), 0) for i in range(weeks)]

    def schedule(self, user: User, span_days: int = 3) -> list[dict[str, Any]]:
        """Return a 7-day schedule strip centered on today.

        Span is ``[today - span_days, today + span_days]``. The today cell
        rolls up everything currently overdue plus questions due today
        (and questions never reviewed). Past cells show questions whose
        natural due-date (last_reviewed + interval) fell on that day.

        Args:
            user: The user whose schedule to compute.
            span_days: Number of days on either side of today.

        Returns:
            List of dicts shaped ``{"dow": str, "date": str, "due": int, "state": str}``.
            ``state`` is one of ``"over"``, ``"today"``, ``"upcoming"``, ``"empty"``.
        """
        Question = apps.get_model("drill", "Question")
        today = timezone.localdate()
        base = Question.objects.filter(
            user=user, is_disabled=False, last_reviewed__isnull=False
        )
        due_at = ExpressionWrapper(
            F("last_reviewed") + F("interval"),
            output_field=DateTimeField(),
        )
        base = base.annotate(due_at=due_at)
        out: list[dict[str, Any]] = []
        for offset in range(-span_days, span_days + 1):
            d = today + timedelta(days=offset)
            if offset < 0:
                start_dt, end_dt = _local_day_bounds(d)
                count = base.filter(due_at__gte=start_dt, due_at__lt=end_dt).count()
                state = "over" if count else "empty"
            elif offset == 0:
                # `base` excludes never-reviewed questions; the second .count() picks them up.
                # Two round-trips at slightly different instants is acceptable for a display strip.
                count = base.filter(
                    Q(interval__lte=timezone.now() - F("last_reviewed"))  # type: ignore[operator]
                ).count() + Question.objects.filter(
                    user=user, is_disabled=False, last_reviewed__isnull=True
                ).count()
                state = "today"
            else:
                start_dt, end_dt = _local_day_bounds(d)
                count = base.filter(due_at__gte=start_dt, due_at__lt=end_dt).count()
                state = "upcoming" if count else "empty"
            out.append({
                "dow": d.strftime("%a").lower(),
                "date": d.strftime("%-d"),
                "due": count,
                "state": state,
            })
        return out

    def activity_heatmap(self, user: User, days: int = 28) -> list[int]:
        """Return per-day response counts for the last ``days`` days, oldest first.

        Args:
            user: The user whose activity to summarize.
            days: Number of trailing days to include (default 28).

        Returns:
            List of ``days`` integers; element 0 is the count for ``days - 1``
            days ago, element ``-1`` is today's count.
        """
        QuestionResponse = apps.get_model("drill", "QuestionResponse")
        today = timezone.localdate()
        start = today - timedelta(days=days - 1)
        rows = (
            QuestionResponse.objects.filter(question__user=user, date__date__gte=start)
            .values("date__date")
            .annotate(n=Count("id"))
        )
        by_day = {r["date__date"]: r["n"] for r in rows}
        return [by_day.get(start + timedelta(days=i), 0) for i in range(days)]

    def recent_responses(self, user: User, n: int = 5) -> list[dict[str, Any]]:
        """Latest ``n`` QuestionResponse rows for the user, newest first.

        Args:
            user: The user whose responses to fetch.
            n: How many to return.

        Returns:
            List of dicts shaped ``{"question": str, "response": str, "date": datetime}``.
        """
        QuestionResponse = apps.get_model("drill", "QuestionResponse")
        qs = (
            QuestionResponse.objects.filter(question__user=user)
            .select_related("question")
            .order_by("-date")[:n]
        )
        return [
            {"question": r.question.question, "response": r.response, "date": r.date}
            for r in qs
        ]

    def responses_by_kind(self, user: User) -> dict[str, int]:
        """Count of QuestionResponse rows per response kind for this user.

        Args:
            user: The user whose responses to count.

        Returns:
            Dict with keys ``easy``, ``good``, ``hard``, ``reset``; missing
            kinds default to zero.
        """
        QuestionResponse = apps.get_model("drill", "QuestionResponse")
        rows = (
            QuestionResponse.objects.filter(question__user=user)
            .values("response")
            .annotate(n=Count("id"))
        )
        # Keys must stay in sync with VALID_RESPONSES in drill/models.py.
        counts = {"easy": 0, "good": 0, "hard": 0, "reset": 0}
        for row in rows:
            if row["response"] in counts:
                counts[row["response"]] = row["n"]
        return counts

    def _batch_tag_progress(
        self, user: User, tag_names: list[str]
    ) -> list[dict[str, Any]]:
        """Compute progress for multiple tags in bulk.

        Args:
            user: The user whose questions to inspect.
            tag_names: List of tag names to compute progress for.

        Returns:
            List of tag progress dicts in the same order as tag_names.
        """
        if not tag_names:
            return []

        Question = apps.get_model("drill", "Question")

        now = timezone.now()
        due_filter = Q(
            question__interval__lte=now - F("question__last_reviewed")  # type: ignore[operator]
        ) | Q(question__last_reviewed__isnull=True)

        stats = (
            Tag.objects.filter(user=user, name__in=tag_names)
            .annotate(
                q_count=Count(
                    "question",
                    filter=Q(question__user=user),
                ),
                q_todo=Count(
                    "question",
                    filter=Q(question__user=user) & due_filter,
                ),
                q_last_reviewed=Max(
                    "question__last_reviewed",
                    filter=Q(question__user=user),
                ),
            )
        )

        stats_by_name = {s.name: s for s in stats}

        results = []
        for name in tag_names:
            stat = stats_by_name.get(name)
            count = stat.q_count if stat else 0
            todo = stat.q_todo if stat else 0
            progress = round(100 - (todo / count * 100)) if count else 0
            last_reviewed_str = (
                stat.q_last_reviewed.strftime("%B %d, %Y")
                if stat and stat.q_last_reviewed
                else "Never"
            )
            results.append({
                "name": name,
                "progress": progress,
                "todo": todo,
                "last_reviewed": last_reviewed_str,
                "last_reviewed_dt": stat.q_last_reviewed if stat else None,
                "url": reverse("drill:start_study_session")
                + f"?study_method=tag&tags={name}",
                "count": count,
            })
        return results


def _local_day_bounds(d: date) -> tuple[datetime, datetime]:
    """Return ``(start_dt, end_dt)`` spanning local calendar day ``d``."""
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(d, datetime.min.time()), tz)
    return start, start + timedelta(days=1)
