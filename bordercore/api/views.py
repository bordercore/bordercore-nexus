"""REST API viewsets for the Bordercore application.

Provides Django REST Framework ``ModelViewSet`` classes for all core models,
handling CRUD operations, Elasticsearch indexing on write, and custom actions
such as fetching untagged bookmarks and pinned tags.
"""

import logging

from elasticsearch.exceptions import NotFoundError
from feed.models import Feed, FeedItem
from typing import cast

from rest_framework.request import Request
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count
from django.db.models import QuerySet

log = logging.getLogger(__name__)

from accounts.models import UserFeed
from lib.mixins import UserScopedQuerysetMixin
from blob.models import Blob
from bookmark.models import Bookmark
from collection.models import Collection
from drill.models import Question
from fitness.models import Data, Exercise, Workout
from fitness.services import get_fitness_summary
from music.models import Album, Playlist, PlaylistItem, Song, SongSource
from node.models import Node
from quote.models import Quote
from reminder.models import Reminder
from tag.models import Tag, TagAlias, TagBookmark
from todo.models import Todo

from .serializers import (AlbumSerializer, BlobSerializer,
                          BlobSha1sumSerializer, BookmarkSerializer,
                          CollectionSerializer, FeedItemSerializer,
                          FeedSerializer, FitnessExerciseSerializer,
                          MobileBookmarkSerializer, NodeSerializer, PinnedTagSerializer,
                          PlaylistItemSerializer, PlaylistSerializer,
                          QuestionSerializer, QuoteSerializer, ReminderSerializer, SongSerializer,
                          SongSourceSerializer, TagAliasSerializer,
                          TagSerializer, TodoSerializer)


class AlbumViewSet(UserScopedQuerysetMixin, viewsets.ModelViewSet):
    """CRUD viewset for albums."""

    permission_classes = [IsAuthenticated]
    serializer_class = AlbumSerializer
    queryset = Album.objects.all()
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[Album]:
        """Return albums owned by the current user with prefetched tags.

        Returns:
            QuerySet of Album objects for the authenticated user.
        """
        return super().get_queryset().prefetch_related("tags")

    def perform_destroy(self, instance: Album) -> None:
        """Delete the album.

        Args:
            instance: The Album instance to delete.
        """
        instance.delete()


class BlobViewSet(viewsets.ModelViewSet):
    """CRUD viewset for blobs with Elasticsearch indexing on create/update."""

    permission_classes = [IsAuthenticated]
    serializer_class = BlobSerializer
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[Blob]:
        """Return blobs visible to the current user.

        The service user can access all blobs; regular users see only their own.

        Returns:
            QuerySet of Blob objects.
        """
        if self.request.user.groups.filter(name="ServiceAccount").exists():
            return Blob.objects.all()
        return Blob.objects.filter(
            user=self.request.user
        ).prefetch_related(
            "metadata",
            "tags"
        )

    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        """Create a blob, bypassing the unique_together (sha1sum, user) constraint.

        Args:
            request: The incoming DRF request.
            *args: Additional positional arguments.
            **kwargs: Additional keyword arguments.

        Returns:
            Response with serialized blob data or validation errors.
        """
        serializer = self.serializer_class(data=request.data, context=self.get_serializer_context())
        if serializer.is_valid():
            instance = serializer.save()
            instance.index_blob()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def perform_destroy(self, instance: Blob) -> None:
        """Delete the blob.

        Args:
            instance: The Blob instance to delete.
        """
        instance.delete()

    def perform_update(self, serializer: BlobSerializer) -> None:
        """Save the blob and re-index it in Elasticsearch.

        Args:
            serializer: The validated BlobSerializer.
        """
        instance = serializer.save()
        instance.index_blob()


class BlobSha1sumViewSet(viewsets.ModelViewSet):
    """Blob viewset that uses sha1sum as the lookup field."""

    permission_classes = [IsAuthenticated]
    serializer_class = BlobSha1sumSerializer
    lookup_field = "sha1sum"

    def get_queryset(self) -> QuerySet[Blob]:
        """Return blobs visible to the current user.

        The service user can access all blobs; regular users see only their own.

        Returns:
            QuerySet of Blob objects.
        """
        if self.request.user.groups.filter(name="ServiceAccount").exists():
            return Blob.objects.all()

        return Blob.objects.filter(
            user=self.request.user
        ).prefetch_related(
            "metadata",
            "tags"
        )

    def perform_create(self, serializer: BlobSha1sumSerializer) -> None:
        """Save the blob and index it in Elasticsearch.

        Args:
            serializer: The validated BlobSha1sumSerializer.
        """
        instance = serializer.save()
        instance.index_blob()


class BookmarkViewSet(UserScopedQuerysetMixin, viewsets.ModelViewSet):
    """CRUD viewset for bookmarks with Elasticsearch indexing and custom actions."""

    permission_classes = [IsAuthenticated]
    serializer_class = BookmarkSerializer
    queryset = Bookmark.objects.all()
    lookup_field = "uuid"
    ordering_fields = ["created", "modified"]
    ordering = ["-created"]

    def get_queryset(self) -> QuerySet[Bookmark]:
        """Return bookmarks owned by the current user with prefetched tags."""
        return super().get_queryset().prefetch_related("tags")

    def perform_create(self, serializer: BookmarkSerializer) -> None:
        """Save the bookmark and index it in Elasticsearch.

        Args:
            serializer: The validated BookmarkSerializer.
        """
        instance = serializer.save()
        instance.index_bookmark()

    def perform_update(self, serializer: BookmarkSerializer) -> None:
        """Save the bookmark and re-index it in Elasticsearch.

        Args:
            serializer: The validated BookmarkSerializer.
        """
        instance = serializer.save()
        instance.index_bookmark()

    def destroy(self, request: Request, *args: object, **kwargs: object) -> Response:
        """Delete the bookmark, logging a warning if the ES document is missing."""
        try:
            return super().destroy(request, *args, **kwargs)
        except NotFoundError:
            log.warning("Bookmark ES document missing during delete, proceeding with DB delete")
            instance = self.get_object()
            instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_destroy(self, instance: Bookmark) -> None:
        """Delete the bookmark."""
        instance.delete()

    @action(detail=False, methods=["get"])
    def untagged(self, request: Request) -> Response:
        """GET /api/bookmarks/untagged/ - Bare bookmarks without tags."""
        queryset = Bookmark.objects.bare_bookmarks(request.user, limit=None).prefetch_related("tags")
        page = self.paginate_queryset(queryset)
        serializer = MobileBookmarkSerializer(page or queryset, many=True)
        if page:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="by-tag/(?P<tag_name>[^/.]+)")
    def by_tag(self, request: Request, tag_name: str | None = None) -> Response:
        """GET /api/bookmarks/by-tag/<tag_name>/ - Bookmarks for a tag."""
        tag_bookmarks = list(TagBookmark.objects.filter(
            tag__name=tag_name,
            tag__user=request.user,
            bookmark__user=request.user,
        ).select_related("bookmark").prefetch_related("bookmark__tags").order_by("sort_order"))

        bookmarks = [tb.bookmark for tb in tag_bookmarks]
        serialized = MobileBookmarkSerializer(bookmarks, many=True).data

        data = []
        for bookmark_data, tb in zip(serialized, tag_bookmarks):
            bookmark_data["sort_order"] = tb.sort_order
            bookmark_data["tag_note"] = tb.note
            data.append(bookmark_data)
        return Response(data)


class CollectionViewSet(UserScopedQuerysetMixin, viewsets.ModelViewSet):
    """CRUD viewset for collections."""

    permission_classes = [IsAuthenticated]
    serializer_class = CollectionSerializer
    queryset = Collection.objects.all()
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[Collection]:
        """Return collections owned by the current user with prefetched tags.

        Returns:
            QuerySet of Collection objects with prefetched tags.
        """
        return super().get_queryset().prefetch_related("tags")

    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        """Create a collection and return its id and uuid.

        Args:
            request: The incoming DRF request.
            *args: Additional positional arguments.
            **kwargs: Additional keyword arguments.

        Returns:
            Response with status, id, and uuid of the new collection.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(user=request.user)
        return Response(
            {"status": "OK", "id": instance.id, "uuid": str(instance.uuid)},
            status=status.HTTP_201_CREATED,
        )


class FeedViewSet(UserScopedQuerysetMixin, viewsets.ModelViewSet):
    """CRUD viewset for RSS/Atom feeds."""

    permission_classes = [IsAuthenticated]
    serializer_class = FeedSerializer
    queryset = Feed.objects.all()
    lookup_field = "uuid"

    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        """Create a feed and return feed info including id, uuid, and name.

        Args:
            request: The incoming DRF request.
            *args: Additional positional arguments.
            **kwargs: Additional keyword arguments.

        Returns:
            Response with status and feed info dict.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(user=request.user)

        user = cast(User, request.user)
        UserFeed(userprofile=user.userprofile, feed=instance).save()

        return Response(
            {
                "status": "OK",
                "feed_info": {
                    "id": instance.id,
                    "uuid": str(instance.uuid),
                    "name": instance.name,
                    "homepage": instance.homepage,
                    "lastCheck": "N/A",
                    "feedItems": [],
                },
            },
            status=status.HTTP_201_CREATED,
        )

    def perform_destroy(self, instance: Feed) -> None:
        """Delete the feed and clear it from the session if active.

        Args:
            instance: The Feed instance to delete.
        """
        # If we're deleting the user's currently viewed feed, delete that from the session
        current_feed = self.request.session.get("current_feed")
        if current_feed and int(current_feed) == instance.id:
            self.request.session.pop("current_feed")

        instance.delete()


class FeedItemViewSet(viewsets.ModelViewSet):
    """CRUD viewset for feed items scoped to the current user's feeds."""

    permission_classes = [IsAuthenticated]
    serializer_class = FeedItemSerializer
    queryset = FeedItem.objects.all()

    def get_queryset(self) -> QuerySet[FeedItem]:
        """Return feed items belonging to the current user's feeds.

        Returns:
            QuerySet of FeedItem objects scoped to the user, with select_related feed.
        """
        return super().get_queryset().filter(
            feed__user=self.request.user
        ).select_related("feed")


class NodeViewSet(UserScopedQuerysetMixin, viewsets.ModelViewSet):
    """CRUD viewset for nodes."""

    permission_classes = [IsAuthenticated]
    serializer_class = NodeSerializer
    queryset = Node.objects.all()
    lookup_field = "uuid"


class QuestionViewSet(UserScopedQuerysetMixin, viewsets.ModelViewSet):
    """CRUD viewset for spaced-repetition drill questions."""

    permission_classes = [IsAuthenticated]
    serializer_class = QuestionSerializer
    queryset = Question.objects.all()
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[Question]:
        """Return questions owned by the current user with prefetched tags.

        Returns:
            QuerySet of Question objects with prefetched tags.
        """
        return super().get_queryset().prefetch_related("tags")


class QuoteViewSet(UserScopedQuerysetMixin, viewsets.ModelViewSet):
    """CRUD viewset for quotes."""

    permission_classes = [IsAuthenticated]
    serializer_class = QuoteSerializer
    queryset = Quote.objects.all()
    lookup_field = "uuid"


class SongViewSet(UserScopedQuerysetMixin, viewsets.ModelViewSet):
    """CRUD viewset for songs."""

    permission_classes = [IsAuthenticated]
    serializer_class = SongSerializer
    queryset = Song.objects.all()
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[Song]:
        """Return songs owned by the current user with prefetched tags.

        Returns:
            QuerySet of Song objects with prefetched tags.
        """
        return super().get_queryset().prefetch_related("tags")


class SongSourceViewSet(viewsets.ModelViewSet):
    """CRUD viewset for song sources."""

    permission_classes = [IsAuthenticated]
    serializer_class = SongSourceSerializer

    def get_queryset(self) -> QuerySet[SongSource]:
        """Return all song sources.

        Returns:
            QuerySet of all SongSource objects.
        """
        return SongSource.objects.all()


class PlaylistViewSet(UserScopedQuerysetMixin, viewsets.ModelViewSet):
    """CRUD viewset for playlists."""

    permission_classes = [IsAuthenticated]
    serializer_class = PlaylistSerializer
    queryset = Playlist.objects.all()
    lookup_field = "uuid"


class PlaylistItemViewSet(viewsets.ModelViewSet):
    """CRUD viewset for playlist items."""

    permission_classes = [IsAuthenticated]
    serializer_class = PlaylistItemSerializer
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[PlaylistItem]:
        """Return playlist items from the current user's playlists.

        Returns:
            QuerySet of PlaylistItem objects for the authenticated user.
        """
        return PlaylistItem.objects.filter(playlist__user=self.request.user)


class TagViewSet(UserScopedQuerysetMixin, viewsets.ModelViewSet):
    """CRUD viewset for tags with a pinned-tags action."""

    permission_classes = [IsAuthenticated]
    serializer_class = TagSerializer
    queryset = Tag.objects.all()

    @action(detail=False, methods=["get"])
    def pinned(self, request: Request) -> Response:
        """GET /api/tags/pinned/ - User's pinned tags with counts."""
        tags = request.user.userprofile.pinned_tags.annotate(
            bookmark_count=Count("tagbookmark")
        ).order_by("usertag__sort_order")
        serializer = PinnedTagSerializer(tags, many=True)
        return Response(serializer.data)


class TagNameViewSet(UserScopedQuerysetMixin, viewsets.ModelViewSet):
    """Tag viewset that uses the tag name as the lookup field."""

    permission_classes = [IsAuthenticated]
    serializer_class = TagSerializer
    queryset = Tag.objects.all()
    lookup_field = "name"


class TagAliasViewSet(viewsets.ModelViewSet):
    """CRUD viewset for tag aliases."""

    permission_classes = [IsAuthenticated]
    serializer_class = TagAliasSerializer
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[TagAlias]:
        """Return tag aliases owned by the current user.

        Returns:
            QuerySet of TagAlias objects with select_related tag.
        """
        return TagAlias.objects.filter(
            user=self.request.user
        ).select_related(
            "tag"
        )


class TodoViewSet(UserScopedQuerysetMixin, viewsets.ModelViewSet):
    """CRUD viewset for todos with optional priority filtering."""

    permission_classes = [IsAuthenticated]
    serializer_class = TodoSerializer
    queryset = Todo.objects.all()
    pagination_class = None
    lookup_field = "uuid"
    ordering_fields = ["priority"]

    def perform_create(self, serializer: TodoSerializer) -> None:
        """Save the todo with the current user as owner.

        Args:
            serializer: The validated TodoSerializer.
        """
        serializer.save(user=self.request.user)

    def get_queryset(self) -> QuerySet[Todo]:
        """Return todos owned by the current user, optionally filtered by priority.

        Returns:
            QuerySet of Todo objects with prefetched tags.
        """
        queryset = super().get_queryset().prefetch_related("tags")

        request = cast(Request, self.request)
        priority = request.query_params.get("priority")
        tag = request.query_params.get("tag")
        if priority is not None:
            queryset = queryset.filter(priority=priority)
        if tag is not None:
            queryset = queryset.filter(tags__name=tag).distinct()

        return queryset


class ReminderViewSet(UserScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only reminders endpoint for mobile clients.

    Returns reminders in the same ordering as the web reminders list.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ReminderSerializer
    queryset = Reminder.objects.all()
    pagination_class = None
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[Reminder]:
        """Return reminders ordered like the web reminders list.

        Returns:
            User-scoped reminder queryset ordered by next trigger then recency.
        """
        return super().get_queryset().order_by("next_trigger_at", "-created")


class FitnessViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["get"])
    def summary(self, request: Request) -> Response:
        """GET /api/fitness/summary/ - Active and inactive exercises for the user."""
        active_exercises, inactive_exercises = get_fitness_summary(request.user)

        active = FitnessExerciseSerializer(active_exercises, many=True).data
        inactive = FitnessExerciseSerializer(inactive_exercises, many=True).data

        return Response({
            "active": active,
            "inactive": inactive,
        })

    @action(detail=False, methods=["get"], url_path=r"exercise/(?P<exercise_uuid>[^/.]+)")
    def exercise(self, request: Request, exercise_uuid: str | None = None) -> Response:
        """GET /api/fitness/exercise/<uuid>/ - Detail data for a single exercise."""
        if not exercise_uuid:
            return Response({"detail": "Exercise UUID required"}, status=status.HTTP_400_BAD_REQUEST)

        exercise = Exercise.objects.filter(uuid=exercise_uuid).first()
        if not exercise:
            return Response({"detail": "Exercise not found"}, status=status.HTTP_404_NOT_FOUND)

        last_workout = exercise.last_workout(request.user)
        recent_data = last_workout.get("recent_data", [])

        return Response({
            "uuid": str(exercise.uuid),
            "name": exercise.name,
            "has_weight": exercise.has_weight,
            "has_duration": exercise.has_duration,
            "description": exercise.description,
            "note": exercise.note,
            "last_workout_date": recent_data[0].date if recent_data else None,
            "latest_weight": last_workout.get("latest_weight", []),
            "latest_reps": last_workout.get("latest_reps", []),
            "latest_duration": last_workout.get("latest_duration", []),
        })

    @action(detail=False, methods=["post"], url_path=r"exercise/(?P<exercise_uuid>[^/.]+)/workouts")
    def add_workout(self, request: Request, exercise_uuid: str | None = None) -> Response:
        """POST /api/fitness/exercise/<uuid>/workouts/ - Add a workout with one or more sets."""
        if not exercise_uuid:
            return Response({"detail": "Exercise UUID required"}, status=status.HTTP_400_BAD_REQUEST)

        exercise = Exercise.objects.filter(uuid=exercise_uuid).first()
        if not exercise:
            return Response({"detail": "Exercise not found"}, status=status.HTTP_404_NOT_FOUND)

        sets = request.data.get("sets", [])
        note = request.data.get("note", "")

        if not isinstance(sets, list) or len(sets) == 0:
            return Response({"detail": "At least one set is required"}, status=status.HTTP_400_BAD_REQUEST)

        parsed_sets = []
        for item in sets:
            if not isinstance(item, dict):
                return Response({"detail": "Invalid set payload"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                parsed_sets.append({
                    "weight": float(item.get("weight") or 0),
                    "duration": int(item.get("duration") or 0),
                    "reps": int(item.get("reps") or 0),
                })
            except (TypeError, ValueError):
                return Response({"detail": "Invalid numeric values in sets"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            workout = Workout.objects.create(
                user=request.user,
                exercise=exercise,
                note=note or "",
            )
            Data.objects.bulk_create(
                [
                    Data(
                        workout=workout,
                        weight=item["weight"],
                        duration=item["duration"],
                        reps=item["reps"],
                    )
                    for item in parsed_sets
                ]
            )

        return Response({"status": "OK"}, status=status.HTTP_201_CREATED)
