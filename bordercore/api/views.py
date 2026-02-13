"""REST API viewsets for the Bordercore application.

Provides Django REST Framework ``ModelViewSet`` classes for all core models,
handling CRUD operations, Elasticsearch indexing on write, and custom actions
such as fetching untagged bookmarks and pinned tags.
"""

from elasticsearch.exceptions import NotFoundError
from feed.models import Feed, FeedItem
from rest_framework.request import Request
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.contrib import messages
from django.db.models import Count
from django.db.models import QuerySet

from accounts.models import UserFeed
from blob.models import Blob
from bookmark.models import Bookmark
from collection.models import Collection
from drill.models import Question
from music.models import Album, Playlist, PlaylistItem, Song, SongSource
from node.models import Node
from quote.models import Quote
from tag.models import Tag, TagAlias, TagBookmark
from todo.models import Todo

from .serializers import (AlbumSerializer, BlobSerializer,
                          BlobSha1sumSerializer, BookmarkSerializer,
                          CollectionSerializer, FeedItemSerializer,
                          FeedSerializer, MobileBookmarkSerializer,
                          NodeSerializer, PinnedTagSerializer,
                          PlaylistItemSerializer, PlaylistSerializer,
                          QuestionSerializer, QuoteSerializer, SongSerializer,
                          SongSourceSerializer, TagAliasSerializer,
                          TagSerializer, TodoSerializer)


class AlbumViewSet(viewsets.ModelViewSet):
    """CRUD viewset for albums."""

    permission_classes = [IsAuthenticated]
    serializer_class = AlbumSerializer
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[Album]:
        """Return albums owned by the current user.

        Returns:
            QuerySet of Album objects for the authenticated user.
        """
        return Album.objects.filter(
            user=self.request.user
        ).prefetch_related(
            "tags"
        )

    def perform_destroy(self, instance: Album) -> None:
        """Delete the album and display a success message.

        Args:
            instance: The Album instance to delete.
        """
        instance.delete()
        messages.add_message(self.request, messages.INFO, "Album successfully deleted")


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
        if self.request.user.username == "service_user":
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
        blob = Blob()
        serializer = self.serializer_class(blob, data=request.data)
        if serializer.is_valid():
            serializer.save()
            blob.index_blob()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def perform_destroy(self, instance: Blob) -> None:
        """Delete the blob and display a success message.

        Args:
            instance: The Blob instance to delete.
        """
        instance.delete()
        messages.add_message(self.request, messages.INFO, "Blob successfully deleted")

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
        if self.request.user.username == "service_user":
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


class BookmarkViewSet(viewsets.ModelViewSet):
    """CRUD viewset for bookmarks with Elasticsearch indexing and custom actions."""

    permission_classes = [IsAuthenticated]
    serializer_class = BookmarkSerializer
    lookup_field = "uuid"
    ordering_fields = ["created, modified"]
    ordering = ["-created"]

    def get_queryset(self) -> QuerySet[Bookmark]:
        """Return bookmarks owned by the current user.

        Returns:
            QuerySet of Bookmark objects for the authenticated user.
        """
        return Bookmark.objects.filter(user=self.request.user)

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
        """Override destroy to catch NotFoundError and return JSON error response."""
        try:
            return super().destroy(request, *args, **kwargs)
        except NotFoundError:
            return Response(
                {"status": "ERROR", "message": "Bookmark not found in Elasticsearch"},
                status=status.HTTP_404_NOT_FOUND
            )

    def perform_destroy(self, instance: Bookmark) -> None:
        """Delete the bookmark."""
        instance.delete()

    @action(detail=False, methods=["get"])
    def untagged(self, request: Request) -> Response:
        """GET /api/bookmarks/untagged/ - Bare bookmarks without tags."""
        queryset = Bookmark.objects.bare_bookmarks(request.user, limit=None)
        page = self.paginate_queryset(queryset)
        serializer = MobileBookmarkSerializer(page or queryset, many=True)
        if page:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="by-tag/(?P<tag_name>[^/.]+)")
    def by_tag(self, request: Request, tag_name: str | None = None) -> Response:
        """GET /api/bookmarks/by-tag/<tag_name>/ - Bookmarks for a tag."""
        tag_bookmarks = TagBookmark.objects.filter(
            tag__name=tag_name,
            tag__user=request.user,
            bookmark__user=request.user,
        ).select_related("bookmark").order_by("sort_order")
        # Return bookmarks with sort_order
        data = []
        for tb in tag_bookmarks:
            bookmark_data = MobileBookmarkSerializer(tb.bookmark).data
            bookmark_data["sort_order"] = tb.sort_order
            bookmark_data["tag_note"] = tb.note
            data.append(bookmark_data)
        return Response(data)


class CollectionViewSet(viewsets.ModelViewSet):
    """CRUD viewset for collections."""

    permission_classes = [IsAuthenticated]
    serializer_class = CollectionSerializer
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[Collection]:
        """Return collections owned by the current user.

        Returns:
            QuerySet of Collection objects with prefetched tags.
        """
        return Collection.objects.filter(
            user=self.request.user
        ).prefetch_related(
            "tags"
        )

    def perform_create(self, serializer: CollectionSerializer) -> None:
        """Save the collection with the current user as owner.

        Args:
            serializer: The validated CollectionSerializer.
        """
        instance = serializer.save(user=self.request.user)

        # Save a copy of the new object so we can reference it in create()
        self._instance = instance

    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        """Create a collection and return its id and uuid.

        Args:
            request: The incoming DRF request.
            *args: Additional positional arguments.
            **kwargs: Additional keyword arguments.

        Returns:
            Response with status, id, and uuid of the new collection.
        """
        response = super(CollectionViewSet, self).create(request, *args, **kwargs)
        response.data = {
            "status": "OK",
            "id": self._instance.id,
            "uuid": self._instance.uuid
        }
        return response


class FeedViewSet(viewsets.ModelViewSet):
    """CRUD viewset for RSS/Atom feeds."""

    permission_classes = [IsAuthenticated]
    serializer_class = FeedSerializer
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[Feed]:
        """Return feeds owned by the current user.

        Returns:
            QuerySet of Feed objects for the authenticated user.
        """
        return Feed.objects.filter(user=self.request.user)

    def perform_create(self, serializer: FeedSerializer) -> None:
        """Save the feed, create a UserFeed link, and stash the instance.

        Args:
            serializer: The validated FeedSerializer.
        """
        instance = serializer.save(user=self.request.user)
        so = UserFeed(userprofile=self.request.user.userprofile, feed=instance)
        so.save()

        # Save a copy of the new object so we can reference it in create()
        self._instance = instance

    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        """Create a feed and return feed info including id, uuid, and name.

        Args:
            request: The incoming DRF request.
            *args: Additional positional arguments.
            **kwargs: Additional keyword arguments.

        Returns:
            Response with status and feed info dict.
        """
        response = super(FeedViewSet, self).create(request, *args, **kwargs)
        response.data = {
            "status": "OK",
            "feed_info": {
                "id": self._instance.id,
                "uuid": self._instance.uuid,
                "name": self._instance.name,
                "homepage": self._instance.homepage,
                "lastCheck": "N/A",
                "feedItems": []
            }
        }
        return response

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
    """CRUD viewset for feed items."""

    permission_classes = [IsAuthenticated]
    serializer_class = FeedItemSerializer
    queryset = FeedItem.objects.filter()

    def get_queryset(self) -> QuerySet[FeedItem]:
        """Return all feed items with their parent feed.

        Returns:
            QuerySet of FeedItem objects with select_related feed.
        """
        return FeedItem.objects.all().select_related("feed")


class NodeViewSet(viewsets.ModelViewSet):
    """CRUD viewset for nodes."""

    permission_classes = [IsAuthenticated]
    serializer_class = NodeSerializer
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[Node]:
        """Return nodes owned by the current user.

        Returns:
            QuerySet of Node objects for the authenticated user.
        """
        return Node.objects.filter(user=self.request.user)


class QuestionViewSet(viewsets.ModelViewSet):
    """CRUD viewset for spaced-repetition drill questions."""

    permission_classes = [IsAuthenticated]
    serializer_class = QuestionSerializer
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[Question]:
        """Return questions owned by the current user.

        Returns:
            QuerySet of Question objects with prefetched tags.
        """
        return Question.objects.filter(
            user=self.request.user
        ).prefetch_related(
            "tags"
        )


class QuoteViewSet(viewsets.ModelViewSet):
    """CRUD viewset for quotes."""

    permission_classes = [IsAuthenticated]
    serializer_class = QuoteSerializer
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[Quote]:
        """Return quotes owned by the current user.

        Returns:
            QuerySet of Quote objects for the authenticated user.
        """
        return Quote.objects.filter(user=self.request.user)


class SongViewSet(viewsets.ModelViewSet):
    """CRUD viewset for songs."""

    permission_classes = [IsAuthenticated]
    serializer_class = SongSerializer
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[Song]:
        """Return songs owned by the current user.

        Returns:
            QuerySet of Song objects with prefetched tags.
        """
        return Song.objects.filter(
            user=self.request.user
        ).prefetch_related(
            "tags"
        )


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


class PlaylistViewSet(viewsets.ModelViewSet):
    """CRUD viewset for playlists."""

    permission_classes = [IsAuthenticated]
    serializer_class = PlaylistSerializer
    lookup_field = "uuid"

    def get_queryset(self) -> QuerySet[Playlist]:
        """Return playlists owned by the current user.

        Returns:
            QuerySet of Playlist objects for the authenticated user.
        """
        return Playlist.objects.filter(user=self.request.user)


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


class TagViewSet(viewsets.ModelViewSet):
    """CRUD viewset for tags with a pinned-tags action."""

    permission_classes = [IsAuthenticated]
    serializer_class = TagSerializer

    def get_queryset(self) -> QuerySet[Tag]:
        """Return tags owned by the current user.

        Returns:
            QuerySet of Tag objects for the authenticated user.
        """
        return Tag.objects.filter(user=self.request.user)

    @action(detail=False, methods=["get"])
    def pinned(self, request: Request) -> Response:
        """GET /api/tags/pinned/ - User's pinned tags with counts."""
        tags = request.user.userprofile.pinned_tags.annotate(
            bookmark_count=Count("tagbookmark")
        ).order_by("usertag__sort_order")
        serializer = PinnedTagSerializer(tags, many=True)
        return Response(serializer.data)


class TagNameViewSet(viewsets.ModelViewSet):
    """Tag viewset that uses the tag name as the lookup field."""

    permission_classes = [IsAuthenticated]
    serializer_class = TagSerializer
    lookup_field = "name"

    def get_queryset(self) -> QuerySet[Tag]:
        """Return tags owned by the current user.

        Returns:
            QuerySet of Tag objects for the authenticated user.
        """
        return Tag.objects.filter(user=self.request.user)


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


class TodoViewSet(viewsets.ModelViewSet):
    """CRUD viewset for todos with optional priority filtering."""

    permission_classes = [IsAuthenticated]
    serializer_class = TodoSerializer
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
        queryset = Todo.objects.filter(
            user=self.request.user
        ).prefetch_related(
            "tags"
        )

        priority = self.request.query_params.get("priority")
        if priority is not None:
            queryset = queryset.filter(priority=priority)

        return queryset
