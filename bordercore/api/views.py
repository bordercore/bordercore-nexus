from elasticsearch.exceptions import NotFoundError
from feed.models import Feed, FeedItem
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.contrib import messages

from accounts.models import UserFeed
from blob.models import Blob
from bookmark.models import Bookmark
from collection.models import Collection
from drill.models import Question
from music.models import Album, Playlist, PlaylistItem, Song, SongSource
from node.models import Node
from quote.models import Quote
from tag.models import Tag, TagAlias
from todo.models import Todo

from .serializers import (AlbumSerializer, BlobSerializer,
                          BlobSha1sumSerializer, BookmarkSerializer,
                          CollectionSerializer, FeedItemSerializer,
                          FeedSerializer, NodeSerializer,
                          PlaylistItemSerializer, PlaylistSerializer,
                          QuestionSerializer, QuoteSerializer, SongSerializer,
                          SongSourceSerializer, TagAliasSerializer,
                          TagSerializer, TodoSerializer)


class AlbumViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AlbumSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        return Album.objects.filter(
            user=self.request.user
        ).prefetch_related(
            "tags"
        )

    def perform_destroy(self, instance):
        """
        Use this DRF hook to add a message to the user.
        """
        instance.delete()
        messages.add_message(self.request, messages.INFO, "Album successfully deleted")


class BlobViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = BlobSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        """
        Only the owner of the blob or the service user has access
        """
        if self.request.user.username == "service_user":
            return Blob.objects.all()
        return Blob.objects.filter(
            user=self.request.user
        ).prefetch_related(
            "metadata",
            "tags"
        )

    def create(self, request, *args, **kwargs):
        """
        We need to override this to avoid a "unique_together" constraint
        violation when creating blobs without a sha1sum. The constraint
        in question is ("sha1sum", "user").
        """
        blob = Blob()
        serializer = self.serializer_class(blob, data=request.data)
        if serializer.is_valid():
            serializer.save()
            blob.index_blob()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def perform_destroy(self, instance):
        """
        Use this DRF hook to add a message to the user.
        """
        instance.delete()
        messages.add_message(self.request, messages.INFO, "Blob successfully deleted")

    def perform_update(self, serializer):
        instance = serializer.save()
        instance.index_blob()


class BlobSha1sumViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = BlobSha1sumSerializer
    lookup_field = "sha1sum"

    def get_queryset(self):
        """
        Only the owner of the blob or the service user has access
        """
        if self.request.user.username == "service_user":
            return Blob.objects.all()

        return Blob.objects.filter(
            user=self.request.user
        ).prefetch_related(
            "metadata",
            "tags"
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        instance.index_blob()


class BookmarkViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = BookmarkSerializer
    lookup_field = "uuid"
    ordering_fields = ["created, modified"]
    ordering = ["-created"]

    def get_queryset(self):
        return Bookmark.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        instance = serializer.save()
        instance.index_bookmark()

    def perform_update(self, serializer):
        instance = serializer.save()
        instance.index_bookmark()

    def destroy(self, request, *args, **kwargs):
        """Override destroy to catch NotFoundError and return JSON error response."""
        try:
            return super().destroy(request, *args, **kwargs)
        except NotFoundError:
            return Response(
                {"status": "ERROR", "message": "Bookmark not found in Elasticsearch"},
                status=status.HTTP_404_NOT_FOUND
            )

    def perform_destroy(self, instance):
        """Delete the bookmark."""
        instance.delete()


class CollectionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CollectionSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        return Collection.objects.filter(
            user=self.request.user
        ).prefetch_related(
            "tags"
        )

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)

        # Save a copy of the new object so we can reference it in create()
        self._instance = instance

    def create(self, request, *args, **kwargs):
        response = super(CollectionViewSet, self).create(request, *args, **kwargs)
        response.data = {
            "status": "OK",
            "id": self._instance.id,
            "uuid": self._instance.uuid
        }
        return response


class FeedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = FeedSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        return Feed.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        so = UserFeed(userprofile=self.request.user.userprofile, feed=instance)
        so.save()

        # Save a copy of the new object so we can reference it in create()
        self._instance = instance

    def create(self, request, *args, **kwargs):
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

    def perform_destroy(self, instance):
        # If we're deleting the user's currently viewed feed, delete that from the session
        current_feed = self.request.session.get("current_feed")
        if current_feed and int(current_feed) == instance.id:
            self.request.session.pop("current_feed")

        instance.delete()


class FeedItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = FeedItemSerializer
    queryset = FeedItem.objects.filter()

    def get_queryset(self):
        return FeedItem.objects.all().select_related("feed")


class NodeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NodeSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        return Node.objects.filter(user=self.request.user)


class QuestionViewSet(viewsets.ModelViewSet):
    """
    Questions for drilled spaced repetition
    """
    permission_classes = [IsAuthenticated]
    serializer_class = QuestionSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        return Question.objects.filter(
            user=self.request.user
        ).prefetch_related(
            "tags"
        )


class QuoteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = QuoteSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        return Quote.objects.filter(user=self.request.user)


class SongViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SongSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        return Song.objects.filter(
            user=self.request.user
        ).prefetch_related(
            "tags"
        )


class SongSourceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SongSourceSerializer

    def get_queryset(self):
        return SongSource.objects.all()


class PlaylistViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PlaylistSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        return Playlist.objects.filter(user=self.request.user)


class PlaylistItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PlaylistItemSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        return PlaylistItem.objects.filter(playlist__user=self.request.user)


class TagViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TagSerializer

    def get_queryset(self):
        return Tag.objects.filter(user=self.request.user)


class TagNameViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TagSerializer
    lookup_field = "name"

    def get_queryset(self):
        return Tag.objects.filter(user=self.request.user)


class TagAliasViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TagAliasSerializer
    lookup_field = "uuid"

    def get_queryset(self):
        return TagAlias.objects.filter(
            user=self.request.user
        ).select_related(
            "tag"
        )


class TodoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TodoSerializer
    lookup_field = "uuid"
    ordering_fields = ["priority"]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def get_queryset(self):
        queryset = Todo.objects.filter(
            user=self.request.user
        ).prefetch_related(
            "tags"
        )

        priority = self.request.query_params.get("priority")
        if priority is not None:
            queryset = queryset.filter(priority=priority)

        return queryset
