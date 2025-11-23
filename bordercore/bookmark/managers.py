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
    """Custom manager for bookmark queries.

    Provides methods to query bookmarks that are not associated with tags,
    blobs, or collections (referred to as "bare" bookmarks).
    """

    def _bare_bookmarks_qs(
        self,
        user: User,
        *,
        sort: bool = True,
    ) -> QuerySet["Bookmark"]:
        """Get queryset of bare bookmarks for a user.

        A bare bookmark is one that has no tags, is not linked to any blob,
        and is not part of any collection.

        Args:
            user: The user whose bookmarks to query.
            sort: Whether to sort results by creation date (descending).
                Defaults to True.

        Returns:
            QuerySet of Bookmark objects matching the criteria.
        """
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
        """Get a limited set of bare bookmarks for a user.

        Args:
            user: The user whose bookmarks to query.
            limit: Maximum number of bookmarks to return. If None, returns
                all matching bookmarks. Defaults to 10.
            sort: Whether to sort results by creation date (descending).
                Defaults to True.

        Returns:
            QuerySet of Bookmark objects matching the criteria, limited to
            the specified number.
        """
        qs = self._bare_bookmarks_qs(user=user, sort=sort)
        if limit is not None:
            qs = qs[:limit]
        return qs

    def bare_bookmarks_count(self, user: User) -> int:
        """Count the number of bare bookmarks for a user.

        Args:
            user: The user whose bookmarks to count.

        Returns:
            Integer count of bare bookmarks for the user.
        """
        return self._bare_bookmarks_qs(user=user, sort=False).count()
