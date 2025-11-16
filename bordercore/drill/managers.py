"""Custom manager for drill questions and tag-related queries.

This module provides DrillManager, a Django manager extension that adds
custom queryset methods for querying drill questions, calculating progress
metrics, and retrieving tag-related information for the spaced repetition
drill system.
"""

from typing import Any, Union

from django.apps import apps
from django.contrib.auth.models import User
from django.db import models
from django.db.models import F, Max, Q, QuerySet
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

    def get_random_tag(self, user: User) -> dict[str, Union[str, int]] | None:
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

    def get_pinned_tags(self, user: User) -> list[dict[str, Union[str, int]]]:
        """Get the user's pinned tags.

        Args:
            user: The user to get pinned tags for.

        Returns:
            List of tag progress information dictionaries for pinned tags.
        """

        Question = apps.get_model("drill", "Question")

        tags = user.userprofile.pinned_drill_tags.all().only("name").order_by("drilltag__sort_order")

        info = []

        for tag in tags:
            info.append(Question.get_tag_progress(user, tag.name))

        return info

    def get_disabled_tags(self, user: User) -> list[dict[str, Union[str, int]]]:
        """Get the user's disabled tags.

        Args:
            user: The user to get disabled tags for.

        Returns:
            List of tag progress information dictionaries for disabled tags.
        """

        Question = apps.get_model("drill", "Question")

        tag_ids = Question.objects.filter(is_disabled=True).values_list("tags", flat=True)
        tags = Tag.objects.filter(id__in=tag_ids).distinct()

        info = []

        for tag in tags:
            info.append(Question.get_tag_progress(user, tag.name))

        return info

    def recent_tags(self) -> Any:
        """Get the tags most recently attached to questions.

        Returns:
            Tags ordered by most recently created, annotated with the maximum
            creation date.
        """

        Question = apps.get_model("drill", "Question")

        return Question.objects.values(
            name=F("tags__name")
        ).annotate(
            max=Max("created")
        ).order_by(
            "-max"
        )
