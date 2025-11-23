"""
Models for the bookmark system.

This module defines Bookmark (a saved URL with metadata, tags, and cover images),
a custom JSONField for daily bookmark tracking, and utilities for generating
thumbnails, indexing in Elasticsearch, and managing relationships with tags
and collections.
"""

import json
import logging
import re
import uuid
from typing import Any
from urllib.parse import parse_qs, urlparse

import boto3
import isodate
import requests

from django import urls
from django.apps import apps
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import models, transaction
from django.db.models import JSONField
from django.db.models.signals import m2m_changed

from lib.mixins import TimeStampedModel
from lib.time_utils import convert_seconds
from search.services import delete_document, index_document
from tag.models import Tag, TagBookmark

from .managers import BookmarkManager

log = logging.getLogger(f"bordercore.{__name__}")
MAX_AGE = 2592000


class DailyBookmarkJSONField(JSONField):
    """Custom JSONField for daily bookmark tracking.

    This field allows a checkbox on the form to store JSON data (specifically
    {"viewed": "false"}) in the database instead of a boolean value when checked.
    When unchecked or empty, it stores None.
    """
    def to_python(self, value: Any) -> dict[str, str] | None:
        """Convert form input to Python value.

        Args:
            value: The form input value (typically from a checkbox).

        Returns:
            A dict with {"viewed": "false"} if value is truthy, None otherwise.
        """
        if value:
            return {"viewed": "false"}
        return None


class Bookmark(TimeStampedModel):
    """A saved URL bookmark with metadata, tags, and cover images.

    Each Bookmark represents a URL saved by a user, with optional notes, tags,
    pinning status, and cover image thumbnails. Bookmarks can be tracked for
    daily viewing, monitored for URL availability, and indexed in Elasticsearch
    for search.

    Attributes:
        uuid: Stable UUID identifier for this bookmark.
        url: The bookmarked URL (max 1000 characters).
        name: Display name/title for the bookmark.
        user: The User who owns this bookmark.
        note: Optional text note attached to the bookmark.
        tags: Many-to-many relationship with Tag objects.
        is_pinned: Whether this bookmark is pinned for quick access.
        daily: Optional JSON field for daily bookmark tracking.
        last_check: Timestamp of the last URL availability check.
        last_response_code: HTTP response code from the last check.
        importance: Integer importance rating (default 1).
        data: Optional JSON field for additional metadata (e.g., video duration).
        created: Timestamp when the bookmark was created (indexed).
    """

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    url = models.URLField(max_length=1000)
    name = models.TextField()
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    note = models.TextField(blank=True, null=True)
    tags = models.ManyToManyField("tag.Tag")
    is_pinned = models.BooleanField(default=False)
    daily = DailyBookmarkJSONField(blank=True, null=True)
    last_check = models.DateTimeField(null=True)
    last_response_code = models.IntegerField(null=True)
    importance = models.IntegerField(default=1)
    data = JSONField(null=True, blank=True)

    created = models.DateTimeField(db_index=True, auto_now_add=True)

    objects = BookmarkManager()

    def __str__(self) -> str:
        """Return string representation of the bookmark.

        Returns:
            The bookmark's name field.
        """
        return self.name

    def get_tags(self) -> str:
        """Return a comma-separated string of this bookmark's tag names.

        Returns:
            Comma-separated human-readable list of tag names.
        """
        return ", ".join([tag.name for tag in self.tags.all()])

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Save the bookmark and generate cover image if new.

        On first save (when the bookmark is created), this automatically
        generates a cover image thumbnail. After every save, it invalidates
        the user's recent bookmarks cache.

        Args:
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.
        """
        new_object = not self.id

        super().save(*args, **kwargs)

        # Only generate a cover image when the bookmark is first
        #  saved by checking for the existence of an id
        if new_object:
            self.generate_cover_image()

        # After every bookmark mutation, invalidate the cache
        cache.delete(f"recent_bookmarks_{self.user.id}")

    def delete(self, using: str | None = None, keep_parents: bool = False) -> tuple[int, dict[str, int]]:
        """Delete the bookmark and clean up associated resources.

        This removes the bookmark from the database, invalidates the user's
        recent bookmarks cache, removes it from Elasticsearch, and deletes
        all cover image files from S3.

        Args:
            using: Optional database alias.
            keep_parents: Whether to keep parent objects.

        Returns:
            Tuple of (number of objects deleted, dictionary with deletion counts).
        """
        delete_document(str(self.uuid))

        self.delete_cover_image()

        # After every bookmark mutation, invalidate the cache
        cache.delete(f"recent_bookmarks_{self.user.id}")

        return super().delete(using=using, keep_parents=keep_parents)

    def delete_tag(self, tag: "Tag") -> None:
        """
        Remove a tag from this bookmark and keep TagBookmark in sync.

        This:
        * Safely deletes any TagBookmark rows (including duplicates).
        * Removes the tag from the ManyToMany relation.
        * Reindexes the bookmark afterwards.
        """

        with transaction.atomic():
            # Delete all TagBookmark rows for this (bookmark, tag) pair.
            TagBookmark.objects.filter(tag=tag, bookmark=self).delete()

            # Remove tag from the M2M relation. This is safe even if it was already gone.
            self.tags.remove(tag)

        # Refresh search index after the DB state is consistent.
        self.index_bookmark()

    def generate_cover_image(self) -> None:
        """Generate a cover image thumbnail for this bookmark.

        For YouTube URLs, this delegates to generate_youtube_cover_image().
        For other URLs, it publishes a message to SNS to trigger a Puppeteer-based
        screenshot generation service that will create a JPEG thumbnail and store
        it in S3.
        """
        if self.url.startswith("https://www.youtube.com/watch"):
            self.generate_youtube_cover_image()
            return

        sns_topic = settings.SNS_TOPIC_ARN
        client = boto3.client("sns")

        message = {
            "url": self.url,
            "s3key": f"bookmarks/{self.uuid}.png",
            "puppeteer": {
                "screenshot": {
                    "type": "jpeg",
                    "quality": 50,
                    "omitBackground": False
                }
            }
        }

        client.publish(
            TopicArn=sns_topic,
            Message=json.dumps(message),
        )

    def generate_youtube_cover_image(self) -> None:
        """Generate cover image for a YouTube bookmark using the YouTube API.

        This fetches video metadata from Google's YouTube API, extracts the
        thumbnail URL, downloads it, and stores it in S3. It also extracts and
        stores the video duration in the bookmark's data field.
        """

        parsed_url = urlparse(self.url)
        query_params = parse_qs(parsed_url.query)
        youtube_id = query_params.get("v", [None])[0]
        if youtube_id:
            api_key = settings.GOOGLE_API_KEY

            r = requests.get(f"https://www.googleapis.com/youtube/v3/videos?id={youtube_id}&key={api_key}&part=snippet,contentDetails,statistics", timeout=10)
            video_info = r.json()

            # Store the video duration
            try:
                duration = video_info["items"][0]["contentDetails"]["duration"]
                duration_secs = isodate.parse_duration(duration).seconds
                if self.data:
                    self.data["video_duration"] = duration_secs
                else:
                    self.data = {"video_duration": duration_secs}
                self.save()
            except KeyError as e:
                log.warning("Can't parse duration: %s", e)

            s3_resource = boto3.resource("s3")
            bucket_name = settings.AWS_STORAGE_BUCKET_NAME

            r = requests.get(video_info["items"][0]["snippet"]["thumbnails"]["medium"]["url"], timeout=10)
            s3_object = s3_resource.Object(bucket_name, f"bookmarks/{self.uuid}.jpg")
            s3_object.put(
                Body=r.content,
                ContentType="image/jpeg",
                ACL="public-read",
                CacheControl=f"max-age={MAX_AGE}",
                Metadata={"cover-image": "Yes"}
            )

    def delete_cover_image(self) -> None:
        """Remove all cover image files for this bookmark from S3.

        This deletes the PNG, small PNG, and JPG thumbnail files associated
        with this bookmark's UUID from the S3 bucket.
        """

        s3 = boto3.resource("s3")

        key = f"bookmarks/{self.uuid}.png"
        s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key).delete()

        key = f"bookmarks/{self.uuid}-small.png"
        s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key).delete()

        key = f"bookmarks/{self.uuid}.jpg"
        s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key).delete()

    def index_bookmark(self) -> None:
        """Index this bookmark in Elasticsearch."""
        index_document(self.elasticsearch_document)

    @property
    def cover_url(self) -> str:
        """Return the URL for this bookmark's full-size cover image.

        Returns:
            Full URL path to the PNG cover image in S3.
        """
        return f"{settings.COVER_URL}bookmarks/{self.uuid}.png"

    @staticmethod
    def thumbnail_url_static(bookmark_uuid: str, url: str) -> str:
        """Return the thumbnail URL for a bookmark given its UUID and URL.

        For YouTube URLs, returns the JPG thumbnail. For other URLs, returns
        the small PNG thumbnail.

        Args:
            bookmark_uuid: The UUID of the bookmark.
            url: The bookmark's URL string.

        Returns:
            Full URL path to the appropriate thumbnail image in S3.
        """
        prefix = f"{settings.COVER_URL}bookmarks"

        if url.startswith("https://www.youtube.com/watch"):
            return f"{prefix}/{bookmark_uuid}.jpg"
        return f"{prefix}/{bookmark_uuid}-small.png"

    @property
    def thumbnail_url(self) -> str:
        """Return the thumbnail URL for this bookmark.

        Returns:
            Full URL path to the appropriate thumbnail image in S3.
        """
        return Bookmark.thumbnail_url_static(str(self.uuid), self.url)

    @property
    def video_duration(self) -> str:
        """Return a human-readable video duration string.

        Returns:
            Formatted duration string (e.g., "5:23") if available, empty string otherwise.
        """
        if self.data and "video_duration" in self.data:
            return convert_seconds(self.data["video_duration"])
        return ""

    @property
    def elasticsearch_document(self) -> dict[str, Any]:
        """Return a representation of the bookmark suitable for indexing in Elasticsearch.

        Returns:
            Dictionary containing the bookmark data formatted for Elasticsearch indexing.
        """

        return {
            "_index": settings.ELASTICSEARCH_INDEX,
            "_id": self.uuid,
            "_source": {
                "bordercore_id": self.id,
                "name": self.name,
                "tags": list(self.tags.values_list("name", flat=True)),
                "url": self.url,
                "note": self.note,
                "importance": self.importance,
                "last_modified": self.modified,
                "doctype": "bookmark",
                "date": {"gte": self.created.strftime("%Y-%m-%d %H:%M:%S"), "lte": self.created.strftime("%Y-%m-%d %H:%M:%S")},
                "date_unixtime": self.created.strftime("%s"),
                "user_id": self.user.id,
                "uuid": self.uuid,
                **settings.ELASTICSEARCH_EXTRA_FIELDS
            }
        }

    def snarf_favicon(self) -> None:
        """Trigger an asynchronous Lambda function to fetch and store the bookmark's favicon.

        This invokes the SnarfFavicon Lambda function asynchronously to extract
        the favicon from the bookmark's URL and store it in S3.
        """
        client = boto3.client("lambda")

        payload = {
            "url": self.url,
            "parse_domain": True
        }

        client.invoke(
            ClientContext="MyApp",
            FunctionName="SnarfFavicon",
            InvocationType="Event",
            LogType="Tail",
            Payload=json.dumps(payload)
        )

    def get_favicon_img_tag(self, size: int = 32) -> str:
        """Return an HTML img tag for this bookmark's favicon.

        Args:
            size: The width and height of the favicon image in pixels (default 32).

        Returns:
            HTML img tag string pointing to the favicon, or empty string if unavailable.
        """
        return Bookmark.get_favicon_img_tag_static(self.url, size)

    @staticmethod
    def get_favicon_img_tag_static(url: str, size: int = 32) -> str:
        """Return an HTML img tag for a favicon given a URL.

        This extracts the domain from the URL, strips the "www." prefix if present,
        and returns an img tag pointing to the favicon stored in S3.

        Args:
            url: The URL to extract the domain from.
            size: The width and height of the favicon image in pixels (default 32).

        Returns:
            HTML img tag string pointing to the favicon, or empty string if the
            URL cannot be parsed or is empty.
        """
        if not url:
            return ""

        p = re.compile("https?://([^/]*)")

        m = p.match(url)

        if m:
            domain = m.group(1)
            parts = domain.split(".")
            # We want the domain part of the hostname (eg npr.org instead of www.npr.org)
            if len(parts) == 3:
                domain = ".".join(parts[1:])
            return f"<img src=\"https://www.bordercore.com/favicons/{domain}.ico\" width=\"{size}\" height=\"{size}\" />"
        return ""

    def related_nodes(self) -> list[dict[str, str]]:
        """Return a list of nodes that contain collections with this bookmark.

        This searches through all nodes owned by the bookmark's user and finds
        any nodes whose layout includes collections that contain this bookmark.

        Returns:
            A list of dictionaries, each containing:
            - "name": The node's name.
            - "url": The URL to view the node detail page.
            - "uuid": The node's UUID.
        """
        Node = apps.get_model("node", "Node")

        # Collect all collection UUIDs in one query
        collection_uuids = {
            str(co.collection.uuid)
            for co in self.collectionobject_set.select_related("collection").all()
            if co.collection is not None
        }

        if not collection_uuids:
            return []

        # Fetch all nodes once
        nodes = Node.objects.filter(user=self.user).only("id", "name", "uuid", "layout")
        found_nodes = set()

        # Check each node's layout efficiently
        for node in nodes:
            if not node.layout:
                continue
            # Check if any collection UUID appears in any column/item
            if any(
                str(item.get("uuid")) in collection_uuids
                for col in node.layout
                for item in col
                if isinstance(item, dict) and "uuid" in item
            ):
                found_nodes.add(node)

        return [
            {
                "name": x.name,
                "url": urls.reverse("node:detail", kwargs={"uuid": x.uuid}),
                "uuid": str(x.uuid)
            }
            for x in found_nodes
        ]


def tags_changed(sender: type[Bookmark], **kwargs: Any) -> None:
    """Signal handler for when tags are added to a bookmark.

    When tags are added to a bookmark via the many-to-many relationship, this
    creates corresponding TagBookmark relationship objects to track the association.

    Args:
        sender: The model class that sent the signal.
        **kwargs: Signal keyword arguments including:
            - "action": The action being performed (we only handle "post_add").
            - "instance": The Bookmark instance being modified.
            - "pk_set": Set of primary keys for tags being added.
    """
    if kwargs["action"] == "post_add":
        bookmark = kwargs["instance"]

        for tag_id in kwargs["pk_set"]:
            tb = TagBookmark(tag=Tag.objects.get(pk=tag_id), bookmark=bookmark)
            tb.save()


m2m_changed.connect(tags_changed, sender=Bookmark.tags.through)
