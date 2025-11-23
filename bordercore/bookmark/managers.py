"""Custom manager for bookmark queries.

This module provides BookmarkManager, a Django manager extension that adds
custom queryset methods for querying bookmarks that are not associated with
tags, blobs, or collections.
"""

from typing import TYPE_CHECKING

from django.apps import apps
from django.contrib.auth.models import User
from django.db import models
from django.db.models import QuerySet

if TYPE_CHECKING:
    from .models import Bookmark


class BookmarkManager(models.Manager["Bookmark"]):
    """Custom manager for bookmark queries."""

    def _bare_bookmarks_qs(
        self,
        user: User,
        *,
        sort: bool = True,
    ) -> QuerySet["Bookmark"]:
        Bookmark = apps.get_model("bookmark", "Bookmark")

        qs = Bookmark.objects.filter(
            user=user,
            tags__isnull=True,
            blobtoobject__isnull=True,
            collectionobject__isnull=True,
        )
        if sort:
            qs = qs.order_by("-created")
        return qs

    def bare_bookmarks(
        self,
        user: User,
        limit: int | None = 10,
        *,
        sort: bool = True,
    ) -> QuerySet["Bookmark"]:
        qs = self._bare_bookmarks_qs(user=user, sort=sort)
        if limit is not None:
            qs = qs[:limit]
        return qs

    def bare_bookmarks_count(self, user: User) -> int:
        return self._bare_bookmarks_qs(user=user, sort=False).count()
