from pathlib import Path

from feed.models import Feed, FeedItem
from rest_framework import serializers

from accounts.models import User
from blob.models import Blob, MetaData
from bookmark.models import Bookmark
from collection.models import Collection
from drill.models import Question
from music.models import Album, Playlist, PlaylistItem, Song, SongSource
from node.models import Node
from quote.models import Quote
from tag.models import Tag, TagAlias
from todo.models import Todo


class AlbumSerializer(serializers.ModelSerializer):
    class Meta:
        model = Album
        fields = ["artist", "compilation", "note", "original_release_year",
                  "tags", "title", "year"]


class BlobFileField(serializers.RelatedField):
    """
    Extract just the filename from the file path
    """
    def to_representation(self, value):
        return Path(value.name).name


class BlobMetaDataField(serializers.RelatedField):
    def to_representation(self, value):
        return {
            value.name: value.value
        }


class BlobTagsField(serializers.RelatedField):
    def to_representation(self, value):
        return value.name

    def to_internal_value(self, data):
        return data


class BlobUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id"]


class BlobSerializer(serializers.ModelSerializer):

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

    # Override __init__ so that we can parse an optional "fields" searcharg
    #  to specify which fields should be returned, overriding the default set
    def __init__(self, *args, **kwargs):

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

    file = BlobFileField(read_only=True)
    metadata = BlobMetaDataField(many=True, read_only=True)
    tags = BlobTagsField(many=True, read_only=True)

    class Meta:
        model = Blob
        fields = ["created", "content", "date", "file", "id", "importance",
                  "is_note", "metadata", "modified",
                  "name", "note", "sha1sum", "tags", "user", "uuid"]


class BookmarkSerializer(serializers.ModelSerializer):

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

    def get_tags(self, obj):
        return list(obj.tags.values_list("name", flat=True))

    def get_thumbnail_url(self, obj):
        return obj.thumbnail_url

    def get_favicon_url(self, obj):
        return Bookmark.get_favicon_url_static(obj.url)

    def get_video_duration(self, obj):
        return obj.video_duration


class PinnedTagSerializer(serializers.ModelSerializer):
    """Serializer for pinned tags with bookmark counts."""

    bookmark_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tag
        fields = ["name", "bookmark_count"]


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "is_meta", "name", "url", "user"]


class CollectionSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, required=False)

    class Meta:
        model = Collection
        fields = ["description", "is_favorite", "name", "tags"]


class FeedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feed
        fields = ["homepage", "last_check", "last_response_code", "name", "url"]


class FeedItemSerializer(serializers.ModelSerializer):
    feed = FeedSerializer()

    class Meta:
        model = FeedItem
        fields = ["feed", "title", "url"]


class MetaDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetaData
        fields = ["name", "value", "blob", "user"]


class NodeSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Node
        fields = ["name", "user"]


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ["answer", "interval", "last_reviewed",
                  "question", "tags", "times_failed", "user"]


class QuoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quote
        fields = ["quote", "source", "user"]


class SongSerializer(serializers.ModelSerializer):
    class Meta:
        model = Song
        fields = ["album", "artist", "last_time_played", "length", "note",
                  "original_album", "original_year", "source", "tags",
                  "times_played", "title", "track", "uuid", "year"]


class SongSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SongSource
        fields = ["description", "name"]


class PlaylistSerializer(serializers.ModelSerializer):
    class Meta:
        model = Playlist
        fields = ["uuid", "name", "note", "size", "parameters", "type"]


class PlaylistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaylistItem
        fields = ["uuid", "playlist", "song"]


class TagAliasSerializer(serializers.ModelSerializer):
    tag = TagSerializer()

    class Meta:
        model = TagAlias
        fields = ["uuid", "name", "tag", "user"]


class TodoSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    tags = BlobTagsField(queryset=Tag.objects.all(), many=True)
    due_date = serializers.DateTimeField(required=False, input_formats=["%Y-%m-%d"])

    class Meta:
        model = Todo
        fields = ["due_date", "id", "note", "tags", "name", "priority", "url", "user", "uuid"]

    def create(self, validated_data):

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

    def update(self, instance, validated_data):

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
