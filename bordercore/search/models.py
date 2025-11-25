"""
Models for the search system.

This module defines RecentSearch, which tracks a user's recent search queries
and maintains them in a sorted order for quick access.
"""

from __future__ import annotations

import uuid

from django.contrib.auth.models import User
from django.db import models, transaction
from django.db.models import F

from lib.mixins import TimeStampedModel


class RecentSearch(TimeStampedModel):
    """A single recent search query entry for a user.

    Each RecentSearch tracks one search text string, maintains a sort order
    for display purposes, and is associated with a user. The system maintains
    a maximum number of recent searches per user (MAX_SIZE).
    """

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    search_text = models.TextField()
    sort_order = models.IntegerField(default=1)
    user = models.ForeignKey(User, on_delete=models.PROTECT)

    MAX_SIZE = 10

    class Meta:
        ordering = ["sort_order", "-created"]
        indexes = [
            models.Index(fields=["user", "sort_order"]),
            models.Index(fields=["user", "search_text"]),
        ]

    def __str__(self) -> str:
        """Return string representation of the search.

        Returns:
            The search text, or empty string if search_text is None.
        """
        return self.search_text or ""

    @classmethod
    def add(cls, user: User, search_text: str) -> None:
        """Add a new search query to the user's recent searches.

        This method adds a search query to the top of the user's recent searches list.
        If the search already exists, it removes the old entry and adds it to the top.
        The method maintains a maximum of MAX_SIZE recent searches per user by
        removing the oldest entries when the limit is exceeded.

        Args:
            user: The user who performed the search.
            search_text: The search query text to add. Whitespace is stripped
                before processing.

        Returns:
            None. The method returns early if the normalized search text is empty.
        """
        normalized = search_text.strip()
        if not normalized:
            return

        with transaction.atomic():
            # Drop existing instance(s) of this search for this user
            cls.objects.filter(user=user, search_text=normalized).delete()

            # Bump sort orders down the list
            cls.objects.filter(user=user).update(sort_order=F("sort_order") + 1)

            # Insert at top
            cls.objects.create(
                user=user,
                search_text=normalized,
                sort_order=1,
            )

            # Trim old entries
            old_ids = list(
                cls.objects.filter(user=user)
                .order_by("-created")
                .values_list("id", flat=True)[cls.MAX_SIZE :]
            )
            if old_ids:
                cls.objects.filter(id__in=old_ids).delete()
