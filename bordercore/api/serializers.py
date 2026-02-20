"""REST API serializers for the Bordercore application.

Defines Django REST Framework serializers for all core models, including
blobs, bookmarks, collections, feeds, music, tags, todos, and more.
"""

from pathlib import Path
from typing import Any

from feed.models import Feed, FeedItem
from rest_framework import serializers

from accounts.models import User
from blob.models import Blob, MetaData
from bookmark.models import Bookmark
from collection.models import Collection
from drill.models import Question
from fitness.models import Exercise
from music.models import Album, Playlist, PlaylistItem, Song, SongSource
from node.models import Node
from quote.models import Quote
from tag.models import Tag, TagAlias
from todo.models import Todo


class AlbumSerializer(serializers.ModelSerializer):
    """Serializer for the Album model."""

    class Meta:
        model = Album
        fields = ["artist", "compilation", "note", "original_release_year",
                  "tags", "title", "year"]


class BlobFileField(serializers.RelatedField):
    """Related field that extracts just the filename from a blob's file path."""

    def to_representation(self, value: Any) -> str:
        """Return the filename component of the file path.

        Args:
            value: The file field value.

        Returns:
            The filename without directory components.
        """
        return Path(value.name).name


class BlobMetaDataField(serializers.RelatedField):
    """Related field that serializes a MetaData instance as a name-value dict."""

    def to_representation(self, value: Any) -> dict[str, Any]:
        """Return a single-entry dict mapping the metadata name to its value.

        Args:
            value: The MetaData instance.

        Returns:
            Dict with one key-value pair from the metadata.
        """
        return {
            value.name: value.value
        }


class BlobTagsField(serializers.RelatedField):
    """Related field that serializes tags by name and accepts raw tag data."""

    def to_representation(self, value: Any) -> str:
        """Return the tag name.

        Args:
            value: The Tag instance.

        Returns:
            The tag's name string.
        """
        return value.name

    def to_internal_value(self, data: Any) -> Any:
        """Pass through raw tag data for processing during create/update.

        Args:
            data: The raw input data.

        Returns:
            The data unchanged.
        """
        return data


class BlobUserSerializer(serializers.ModelSerializer):
    """Minimal user serializer that exposes only the user ID."""

    class Meta:
        model = User
        fields = ["id"]


class BlobSerializer(serializers.ModelSerializer):
    """Full serializer for the Blob model with dynamic field selection.

    Supports an optional ``fields`` query parameter to restrict which fields
    are returned in the response.
    """

    user = BlobUserSerializer(read_only=True, default=serializers.CurrentUserDefault())
    uuid = serializers.UUIDField()
    file = BlobFileField(read_only=True)
    metadata = BlobMetaDataField(many=True, read_only=True)
    sha1sum = serializers.CharField(required=False)
    tags = BlobTagsField(queryset=Tag.objects.all(), many=True)

    class Meta:
        model = Blob
        fields = ["created", "content", "date", "file", "id", "importance",
                  "is_note", "metadata", "modified", "name",
                  "note", "sha1sum", "tags", "user", "uuid"]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Initialize the serializer, optionally filtering fields.

        If the request includes a ``fields`` query parameter (comma-separated),
        only those fields are kept in the serializer output.

        Args:
            *args: Positional arguments passed to the parent.
            **kwargs: Keyword arguments passed to the parent.
        """
        super(BlobSerializer, self).__init__(*args, **kwargs)

        if "request" in self.context:
            fields = self.context["request"].query_params.get("fields")
            if fields:
                fields = fields.split(",")
                # Drop any fields that are not specified in the `fields` argument.
                allowed = set(fields)
                existing = set(self.fields.keys())
                for field_name in existing - allowed:
                    self.fields.pop(field_name)


class BlobSha1sumSerializer(serializers.ModelSerializer):
    """Blob serializer that uses sha1sum as the lookup field."""

    file = BlobFileField(read_only=True)
    metadata = BlobMetaDataField(many=True, read_only=True)
    tags = BlobTagsField(many=True, read_only=True)

    class Meta:
        model = Blob
        fields = ["created", "content", "date", "file", "id", "importance",
                  "is_note", "metadata", "modified",
                  "name", "note", "sha1sum", "tags", "user", "uuid"]


class BookmarkSerializer(serializers.ModelSerializer):
    """Serializer for the Bookmark model."""

    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Bookmark
        fields = ["daily", "importance", "is_pinned", "last_check",
                  "last_response_code", "note", "name", "url", "user", "uuid"]


class MobileBookmarkSerializer(serializers.ModelSerializer):
    """Serializer for mobile apps with denormalized tag and media data."""

    tags = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    favicon_url = serializers.SerializerMethodField()
    video_duration = serializers.SerializerMethodField()

    class Meta:
        model = Bookmark
        fields = ["uuid", "name", "url", "note", "created", "last_response_code",
                  "importance", "is_pinned", "tags", "thumbnail_url", "favicon_url",
                  "video_duration"]

    def get_tags(self, obj: Bookmark) -> list[str]:
        """Return the bookmark's tag names as a list.

        Args:
            obj: The Bookmark instance.

        Returns:
            List of tag name strings.
        """
        prefetched = getattr(obj, "_prefetched_objects_cache", {})
        if "tags" in prefetched:
            return [tag.name for tag in prefetched["tags"]]
        return [tag.name for tag in obj.tags.all()]

    def get_thumbnail_url(self, obj: Bookmark) -> str:
        """Return the bookmark's thumbnail URL, or empty string if absent.

        Args:
            obj: The Bookmark instance.

        Returns:
            Thumbnail URL string.
        """
        return obj.thumbnail_url or ""

    def get_favicon_url(self, obj: Bookmark) -> str:
        """Return the favicon URL for the bookmark's domain.

        Args:
            obj: The Bookmark instance.

        Returns:
            Favicon URL string.
        """
        return Bookmark.get_favicon_url_static(obj.url) or ""

    def get_video_duration(self, obj: Bookmark) -> str | None:
        """Return the video duration if the bookmark links to a video.

        Args:
            obj: The Bookmark instance.

        Returns:
            Duration string, or None.
        """
        return obj.video_duration


class PinnedTagSerializer(serializers.ModelSerializer):
    """Serializer for pinned tags with bookmark counts."""

    bookmark_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tag
        fields = ["name", "bookmark_count"]


class FitnessExerciseSerializer(serializers.ModelSerializer):
    last_active = serializers.DateTimeField(required=False, allow_null=True)
    muscle_group = serializers.SerializerMethodField()
    schedule_days = serializers.SerializerMethodField()
    frequency = serializers.SerializerMethodField()
    delta_days = serializers.SerializerMethodField()
    overdue = serializers.SerializerMethodField()

    class Meta:
        model = Exercise
        fields = [
            "uuid",
            "name",
            "muscle_group",
            "last_active",
            "delta_days",
            "overdue",
            "schedule_days",
            "frequency",
        ]

    def get_muscle_group(self, obj: Exercise) -> str:
        muscle = obj.muscle.first()
        if not muscle:
            return ""
        return str(muscle.muscle_group)

    def get_schedule_days(self, obj: Exercise) -> str:
        return str(getattr(obj, "schedule_days", ""))

    def get_frequency(self, obj: Exercise) -> str:
        frequency = getattr(obj, "frequency", None)
        if not frequency:
            return ""
        days = getattr(frequency, "days", 0)
        if days <= 0:
            return ""
        return f"{days} day{'s' if days != 1 else ''}"

    def get_delta_days(self, obj: Exercise) -> int | None:
        return getattr(obj, "delta_days", None)

    def get_overdue(self, obj: Exercise) -> int:
        return int(getattr(obj, "overdue", 0))


class TagSerializer(serializers.ModelSerializer):
    """Serializer for the Tag model."""

    class Meta:
        model = Tag
        fields = ["id", "is_meta", "name", "url", "user"]


class CollectionSerializer(serializers.ModelSerializer):
    """Serializer for the Collection model with nested tags."""

    tags = TagSerializer(many=True, required=False)

    class Meta:
        model = Collection
        fields = ["description", "is_favorite", "name", "tags"]


class FeedSerializer(serializers.ModelSerializer):
    """Serializer for the Feed model."""

    class Meta:
        model = Feed
        fields = ["homepage", "last_check", "last_response_code", "name", "url"]


class FeedItemSerializer(serializers.ModelSerializer):
    """Serializer for the FeedItem model with a nested feed."""

    feed = FeedSerializer()

    class Meta:
        model = FeedItem
        fields = ["feed", "title", "url"]


class MetaDataSerializer(serializers.ModelSerializer):
    """Serializer for the blob MetaData model."""

    class Meta:
        model = MetaData
        fields = ["name", "value", "blob", "user"]


class NodeSerializer(serializers.ModelSerializer):
    """Serializer for the Node model."""

    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Node
        fields = ["name", "user"]


class QuestionSerializer(serializers.ModelSerializer):
    """Serializer for the spaced-repetition Question model."""

    class Meta:
        model = Question
        fields = ["answer", "interval", "last_reviewed",
                  "question", "tags", "times_failed", "user"]


class QuoteSerializer(serializers.ModelSerializer):
    """Serializer for the Quote model."""

    class Meta:
        model = Quote
        fields = ["quote", "source", "user"]


class SongSerializer(serializers.ModelSerializer):
    """Serializer for the Song model."""

    class Meta:
        model = Song
        fields = ["album", "artist", "last_time_played", "length", "note",
                  "original_album", "original_year", "source", "tags",
                  "times_played", "title", "track", "uuid", "year"]


class SongSourceSerializer(serializers.ModelSerializer):
    """Serializer for the SongSource model."""

    class Meta:
        model = SongSource
        fields = ["description", "name"]


class PlaylistSerializer(serializers.ModelSerializer):
    """Serializer for the Playlist model."""

    class Meta:
        model = Playlist
        fields = ["uuid", "name", "note", "size", "parameters", "type"]


class PlaylistItemSerializer(serializers.ModelSerializer):
    """Serializer for the PlaylistItem model."""

    class Meta:
        model = PlaylistItem
        fields = ["uuid", "playlist", "song"]


class TagAliasSerializer(serializers.ModelSerializer):
    """Serializer for the TagAlias model with a nested tag."""

    tag = TagSerializer()

    class Meta:
        model = TagAlias
        fields = ["uuid", "name", "tag", "user"]


class TodoSerializer(serializers.ModelSerializer):
    """Serializer for the Todo model with tag creation on write."""

    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    tags = BlobTagsField(queryset=Tag.objects.all(), many=True)
    due_date = serializers.DateTimeField(required=False, input_formats=["%Y-%m-%d"])

    class Meta:
        model = Todo
        fields = ["due_date", "id", "note", "tags", "name", "priority", "url", "user", "uuid"]

    def create(self, validated_data: dict[str, Any]) -> Todo:
        """Create a new Todo, associating tags by name (creating if needed).

        Args:
            validated_data: Validated serializer data including optional tags.

        Returns:
            The newly created Todo instance.
        """
        tags = validated_data.pop("tags", None)

        # We need to save the task first before adding the m2m
        #  tags field, so don't index in Elasticsearch just yet.
        instance = Todo(**validated_data)
        instance.save(index_es=False)

        if tags:
            instance.tags.set(
                [
                    Tag.objects.get_or_create(name=x, user=self.context["request"].user)[0]
                    for x in
                    tags[0].split(",")
                    if x != ""
                ]
            )

        # Save the task again with any tags and index in Elasticsearch
        instance.save()
        return instance

    def update(self, instance: Todo, validated_data: dict[str, Any]) -> Todo:
        """Update an existing Todo and reassign its tags.

        Args:
            instance: The existing Todo instance to update.
            validated_data: Validated serializer data.

        Returns:
            The updated Todo instance.
        """
        instance.name = validated_data.get("name", instance.name)
        instance.note = validated_data.get("note", instance.note)
        instance.priority = validated_data.get("priority", instance.priority)
        instance.url = validated_data.get("url", instance.url)
        instance.due_date = validated_data.get("due_date", instance.due_date)

        instance.tags.set(
            [
                Tag.objects.get_or_create(name=x, user=instance.user)[0]
                for x in
                validated_data["tags"][0].split(",")
                if x != ""
            ]
        )
        instance.save()
        return instance
