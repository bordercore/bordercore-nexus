"""
Models for blob storage and management.

This module defines Blob (a file/document storage model with metadata, tags,
and relationships), metadata storage (MetaData), relationship tracking
(BlobToObject), and utilities for S3 storage, Elasticsearch indexing, and
file management. It also includes models for tracking recently viewed blobs
and blob templates.
"""

from __future__ import annotations

import datetime
import hashlib
import io
import logging
import re
import uuid
from collections import defaultdict
from datetime import timedelta
from pathlib import PurePath
from typing import Any
from urllib.parse import quote_plus, urlparse
from uuid import UUID

import humanize
from PIL import Image
from storages.backends.s3boto3 import S3Boto3Storage

from django.apps import apps
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import models, transaction
from django.db.models import Count, JSONField, Model, Q
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.forms import ValidationError
from django.urls import reverse

from collection.models import CollectionObject
from lib.mixins import SortOrderMixin, TimeStampedModel
from lib.time_utils import get_date_from_pattern
from lib.util import (get_elasticsearch_connection, is_audio, is_image, is_pdf,
                      is_video)
from node.services import delete_note_from_nodes
from search.services import delete_document
from tag.models import Tag

EDITIONS = {"1": "First",
            "2": "Second",
            "3": "Third",
            "4": "Fourth",
            "5": "Fifth",
            "6": "Sixth",
            "7": "Seventh",
            "8": "Eighth",
            "9": "Ninth"}

MAX_COVER_IMAGE_WIDTH = 800

FILE_TYPES_TO_INGEST = [
    "azw3",
    "chm",
    "epub",
    "html",
    "mp3",
    "pdf",
    "txt"
]

ILLEGAL_FILENAMES = [
    "cover.jpg",
    "cover-large.jpg",
    "cover-small.jpg"
]

log = logging.getLogger(f"bordercore.{__name__}")


class DownloadableS3Boto3Storage(S3Boto3Storage):
    """S3 storage backend that preserves original filenames.

    This storage backend overrides the default Django behavior of cleaning
    filenames (e.g., replacing spaces with underscores) to preserve the
    original filename as uploaded.
    """

    def get_valid_name(self, name: str) -> str:
        """Return the filename unchanged, preserving original characters.

        Args:
            name: The original filename.

        Returns:
            The filename unchanged from the input.
        """
        return name


class Blob(TimeStampedModel):
    """A file or document stored in the system.

    Blob represents a file or document with associated metadata, tags, and
    relationships. It can store files in S3, track content, maintain metadata,
    and link to other Bordercore objects via BlobToObject.

    Attributes:
        uuid: Stable UUID identifier for this blob.
        content: Text content of the blob (for notes or text documents).
        name: Display name for the blob.
        sha1sum: SHA1 hash of the file content for deduplication.
        file: FileField storing the actual file in S3.
        user: Owner of this blob.
        note: Free-form text annotation.
        tags: Many-to-many relationship with Tag objects.
        date: Date string associated with the blob.
        importance: Integer importance level (default 1).
        is_note: Whether this blob is a note (vs. a file).
        is_indexed: Whether this blob should be indexed in Elasticsearch.
        math_support: Whether math rendering is enabled for this blob.
        data: JSON field for additional structured data.
        bc_objects: Many-to-many relationship with BCObject via BlobToObject.
    """

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    content = models.TextField(null=True)
    name = models.TextField(null=True)
    sha1sum = models.CharField(max_length=40, blank=True, null=True)
    file = models.FileField(max_length=500, storage=DownloadableS3Boto3Storage(), blank=True)
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    note = models.TextField(null=True, blank=True)
    tags = models.ManyToManyField(Tag)
    date = models.TextField(null=True)
    importance = models.IntegerField(default=1)
    is_note = models.BooleanField(default=False)
    is_indexed = models.BooleanField(default=True)
    math_support = models.BooleanField(default=False)
    data = JSONField(null=True, blank=True)
    bc_objects = models.ManyToManyField("blob.BCObject", through="blob.BlobToObject", through_fields=("node", "bc_object"))

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("sha1sum", "user"),
                name="unique_blob_sha1sum_user",
            ),
        ]

    def __str__(self) -> str:
        """Return string representation of the blob.

        Returns:
            The blob's name, or empty string if no name is set.
        """
        return self.name or ""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Initialize the blob instance.

        This saves the original filename so that when it changes during a blob
        edit in save(), we can detect the change and delete the old file from S3.

        Args:
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.
        """
        super().__init__(*args, **kwargs)

        # Save the filename so that when it changes by a blob edit
        #  in save() we know what the original was.
        setattr(self, "__original_filename", self.file.name)

    # Properties - File/Storage
    @property
    def parent_dir(self) -> str:
        """Return the S3 directory path for this blob's files.

        Returns:
            String path in the format "{MEDIA_ROOT}/{uuid}".
        """
        return f"{settings.MEDIA_ROOT}/{self.uuid}"

    @property
    def s3_key(self) -> str | None:
        """Return the S3 key (path) for this blob's file.

        Returns:
            S3 key string, or None if no file is associated with this blob.
        """
        if self.file:
            return Blob.get_s3_key(self.uuid, self.file)
        return None

    @property
    def url(self) -> str:
        """Return the URL path for accessing this blob's file.

        Returns:
            URL path string in the format "{uuid}/{url_encoded_filename}".
        """
        return f"{self.uuid}/{quote_plus(str(self.file))}"

    @property
    def cover_url_small(self) -> str:
        """Return the small cover image URL for this blob.

        Returns:
            URL string for the small cover image.
        """
        return self.get_cover_url(size="small")

    # Properties - Metadata/Classification
    @property
    def doctype(self) -> str:
        """Return the document type classification for this blob.

        The type is determined by checking various attributes in order:
        note -> book -> image -> video -> blob -> document.

        Returns:
            String document type: "note", "book", "image", "video", "blob",
            or "document".
        """
        if self.is_note:
            return "note"
        # Check prefetched metadata first to avoid N+1 queries
        if hasattr(self, "_prefetched_objects_cache") and "metadata" in self._prefetched_objects_cache:
            metadata_list = self._prefetched_objects_cache["metadata"]
        else:
            metadata_list = self.metadata.all()
        if any(m.name == "is_book" for m in metadata_list):
            return "book"
        if is_image(self.file):
            return "image"
        if is_video(self.file):
            return "video"
        if self.sha1sum is not None:
            return "blob"
        return "document"

    @property
    def tags_string(self) -> str:
        """Return a comma-separated string of this blob's tag names.

        Returns:
            Comma-separated human-readable list of tag names, sorted alphabetically.
        """
        return ", ".join(sorted(self.tags.values_list("name", flat=True)))

    @property
    def edition_string(self) -> str:
        """Extract and return the edition string from the blob's name.

        If the name ends with a pattern like "2E", this returns the full
        edition string (e.g., "Second Edition").

        Returns:
            Edition string (e.g., "First Edition", "Second Edition"), or
            empty string if no edition pattern is found.
        """
        if self.name:
            pattern = re.compile(r"(.*) (\d)E$")
            matches = pattern.match(self.name)
            if matches and EDITIONS.get(matches.group(2), None):
                return f"{EDITIONS[matches.group(2)]} Edition"

        return ""

    # Properties - Type Checks
    @property
    def is_image(self) -> bool:
        """Check if the blob's file is an image.

        Returns:
            True if the file is an image, False otherwise.
        """
        return is_image(self.file)

    @property
    def is_video(self) -> bool:
        """Check if the blob's file is a video.

        Returns:
            True if the file is a video, False otherwise.
        """
        return is_video(self.file)

    @property
    def is_audio(self) -> bool:
        """Check if the blob's file is an audio file.

        Returns:
            True if the file is audio, False otherwise.
        """
        return is_audio(self.file)

    @property
    def is_pdf(self) -> bool:
        """Check if the blob's file is a PDF.

        Returns:
            True if the file is a PDF, False otherwise.
        """
        return is_pdf(self.file)

    @property
    def is_pinned_note(self) -> bool:
        """Check if this blob is pinned as a note in the user's profile.

        Returns:
            True if the blob is in the user's pinned notes, False otherwise.
        """
        return self in self.user.userprofile.pinned_notes.all()

    # Properties - Date/Time
    @property
    def date_is_year(self) -> bool:
        """Check if the blob's date field contains only a year (YYYY format).

        Returns:
            True if date is exactly four digits, False otherwise.
        """
        if not self.date:
            return False
        return bool(re.fullmatch(r"\d{4}", self.date))

    @property
    def parsed_date(self) -> Any:
        """Parse and return a date object from the blob's date string.

        Returns:
            Date object parsed from the blob's date field using pattern matching.
        """
        return get_date_from_pattern({"gte": self.date})

    # Properties - State/Relationships
    @property
    def has_been_modified(self) -> bool:
        """Check if the blob has been modified after creation.

        If the modified time is greater than the creation time by more than
        one second, assume it has been edited.

        Returns:
            True if the blob was modified after creation, False otherwise.
        """
        return self.modified - self.created > timedelta(seconds=1)

    @property
    def collections(self) -> list[dict[str, Any]]:
        """Return all collections that contain this blob.

        Returns:
            List of dictionaries, each containing collection information:
            name, uuid, url, num_objects, cover_url, and note.
        """
        collection_list = []

        for x in CollectionObject.objects.filter(
                blob=self,
                collection__user=self.user
        ).annotate(
            num_objects=Count("collection__collectionobject")
        ).select_related(
            "collection"
        ):
            if x.collection is None:
                continue
            collection_list.append(
                {
                    "name": x.collection.name,
                    "uuid": x.collection.uuid,
                    "url": x.collection.get_absolute_url(),
                    "num_objects": x.num_objects,
                    "cover_url": x.collection.cover_url,
                    "note": x.note
                }
            )

        return collection_list

    @staticmethod
    def get_content_type(argument: str) -> str:
        """Convert a MIME type string to a human-readable content type name.

        Args:
            argument: MIME type string (e.g., "application/pdf", "image/jpeg").

        Returns:
            Human-readable content type name (e.g., "PDF", "Image", "Video"),
            or empty string if the MIME type is not recognized.
        """
        switcher = {
            "application/mp4": "Video",
            "application/octet-stream": "Video",
            "application/pdf": "PDF",
            "application/x-sqlite3": "SQLite Database",
            "application/x-mobipocket-ebook": "E-Book",
            "audio/mpeg": "Audio",
            "audio/x-wav": "Audio",
            "image/gif": "Image",
            "image/jpeg": "Image",
            "image/png": "Image",
            "video/mp4": "Video",
            "video/webm": "Video",
            "video/x-m4v": "Video"
        }

        return switcher.get(argument, "")

    @staticmethod
    def get_duration_humanized(duration: str) -> str:
        """Convert a duration in seconds to a human-readable time string.

        Args:
            duration: Duration in seconds (as integer or string).

        Returns:
            Human-readable duration string (e.g., "1:23:45" or "45:30"),
            with leading zeros removed.
        """
        duration = str(datetime.timedelta(seconds=int(duration)))

        # Remove any leading "0:0" or "0:"
        duration = re.sub(r"^(0\:0)|^0\:", "", duration)

        return duration

    def get_name(self, remove_edition_string: bool = False, use_filename_if_present: bool = False) -> str:
        """Return the blob's display name with optional formatting.

        Args:
            remove_edition_string: If True, strip edition suffix (e.g., "2E")
                from the name.
            use_filename_if_present: If True and name is empty, return the
                filename instead of "No name".

        Returns:
            The formatted name string, or "No name" if no name is available
            and use_filename_if_present is False.
        """
        name = self.name
        if name:
            if remove_edition_string:
                pattern = re.compile(r"(.*) (\d)E$")
                matches = pattern.match(name)
                if matches and EDITIONS.get(matches.group(2), None):
                    return f"{matches.group(1)}"
            return name
        if use_filename_if_present:
            return PurePath(str(self.file)).name
        return "No name"

    @staticmethod
    def get_s3_key(uuid: UUID, file: Any) -> str:
        """Construct the S3 key path for a blob file.

        Args:
            uuid: UUID of the blob.
            file: FileField or filename string.

        Returns:
            S3 key string in the format "{MEDIA_ROOT}/{uuid}/{file}".
        """
        return f"{settings.MEDIA_ROOT}/{uuid}/{file}"

    def get_metadata(self) -> tuple[dict[str, str], list[dict[str, str]]]:
        """Return all metadata associated with this blob.

        This collects all MetaData entries for the blob, handling duplicate
        names by joining values with commas. URLs are extracted separately
        with their domains.

        Returns:
            Tuple of (metadata_dict, urls_list):
            - metadata_dict: Dictionary mapping metadata names to values.
              If multiple entries share a name, values are comma-joined.
            - urls_list: List of dictionaries with "url" and "domain" keys
              for each URL metadata entry.
        """
        metadata: dict[str, str] = {}
        urls: list[dict[str, str]] = []

        for x in self.metadata.all():
            if x.name == "Url":
                urls.append(
                    {
                        "url": x.value,
                        "domain": urlparse(x.value).netloc
                    }
                )
            if metadata.get(x.name, None):
                metadata[x.name] = ", ".join([metadata[x.name], x.value])
            else:
                metadata[x.name] = x.value

        return metadata, urls

    def get_elasticsearch_info(self) -> dict[str, Any]:
        """Retrieve and format Elasticsearch document information for this blob.

        Queries Elasticsearch for the blob's indexed document and returns
        human-readable formatted fields (content type, size, duration).

        Returns:
            Dictionary containing Elasticsearch document fields with humanized
            values for content_type, size, and duration, plus the document ID.
        """
        es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

        query = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "term": {
                                "uuid": self.uuid
                            }
                        },
                        {
                            "term": {
                                "user_id": self.user.id
                            }
                        }
                    ]
                }
            },
            "_source": [
                "attr_is_book",
                "author",
                "bordercore_id",
                "content_type",
                "doctype",
                "duration",
                "filename",
                "last_modified",
                "name",
                "note",
                "num_pages",
                "tags",
                "task",
                "sha1sum",
                "size",
                "url"
            ]
        }

        hits = es.search(index=settings.ELASTICSEARCH_INDEX, body=query)["hits"]["hits"]
        if not hits:
            return {}
        results = hits[0]

        if "content_type" in results["_source"]:
            results["_source"]["content_type"] = Blob.get_content_type(results["_source"]["content_type"])

        if "size" in results["_source"]:
            results["_source"]["size"] = humanize.naturalsize(results["_source"]["size"])

        if "duration" in results["_source"]:
            results["_source"]["duration"] = Blob.get_duration_humanized(results["_source"]["duration"])

        return {**results["_source"], "id": results["_id"]}

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Save the blob and handle file uploads, SHA1 calculation, and S3 cleanup.

        This method:
        - Sets the S3 storage location based on the blob's UUID
        - Calculates SHA1 hash if a new file is uploaded
        - Deletes old S3 file if the file content changed
        - Updates S3 metadata for file modification time if applicable
        - Invalidates user caches

        Args:
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.
        """
        # Use a custom S3 location for the blob, based on the blob's UUID
        self.file.storage.location = f"blobs/{self.uuid}"

        # We rely on the file.readable() method to determine if a file was
        #  uploaded during a blob update, either because the blob file is new
        #  or the blob's file was changed. If so, calculate the sha1sum.
        if self.file and self.file.readable():

            sha1sum_old = self.sha1sum

            hasher = hashlib.sha1()
            for chunk in self.file.chunks():
                hasher.update(chunk)
            self.sha1sum = hasher.hexdigest()

            # Check if the file has changed. If so, delete the old version from S3.
            # Note: if there is no self.id, then this is a new blob and
            #  therefore we don't need to check for a change.
            if self.id and self.sha1sum != sha1sum_old:
                # This is set in __init__
                filename_orig = getattr(self, "__original_filename")

                log.info("Blob file changed detected. Deleting old file: %s/%s", self.parent_dir, filename_orig)
                log.info("%s != %s", sha1sum_old, self.sha1sum)
                from blob.services import delete_blob_s3_file
                delete_blob_s3_file(self.parent_dir, filename_orig)

        super().save(*args, **kwargs)

        # self.file_modified won't exist if we're editing a blob's
        # information or renaming the file, but not changing the file itself.
        # In that case we don't want to update its "file_modified" metadata.

        if self.file and \
           hasattr(self, "file_modified") and \
           self.file_modified is not None:
            self.set_s3_metadata_file_modified()

        # After every blob mutation, invalidate the cache
        cache.delete(f"recent_blobs_{self.user.id}")
        cache.delete(f"recent_media_{self.user.id}")

    def set_s3_metadata_file_modified(self) -> None:
        """Store a file's modification time as S3 metadata after it's saved.

        Updates the S3 object's metadata with the file modification time.
        Note that Content-Type must be explicitly preserved when updating
        S3 metadata, otherwise it resets to "binary/octet-stream".
        """
        if not hasattr(self, "file_modified") or self.file_modified is None:
            return

        key = self.s3_key
        if key is None:
            return

        from blob.services import update_blob_s3_metadata
        update_blob_s3_metadata(key, str(self.file_modified))

    @staticmethod
    def related_objects(app: str, model: str, base_object: Any) -> list[dict[str, Any]]:
        """Return a list of objects related to the given base object.

        Queries the specified relation model for objects linked to base_object,
        excluding SQL-related entries, and returns formatted dictionaries with
        metadata for each related object (blob, bookmark, or question).

        Args:
            app: Django app name (e.g., "blob", "drill").
            model: Model name within the app (e.g., "BlobToObject").
            base_object: The model instance (Blob, Question, etc.) to find related objects for.

        Returns:
            List of dictionaries, each containing:
            - For blobs: uuid, name, url, edit_url, cover_url, note, type
            - For bookmarks: uuid, name, url, cover_url, cover_url_large,
              favicon_url, edit_url, note, type
            - For questions: uuid, question, note, type
        """
        model_class: Any = apps.get_model(app, model)

        related_objects = []

        for related_object in model_class.objects.filter(node=base_object).exclude(note="sql").select_related("bookmark").select_related("blob"):
            if related_object.blob:
                related_objects.append(
                    {
                        "bc_object_uuid": related_object.uuid,
                        "type": "blob",
                        "uuid": related_object.blob.uuid,
                        "name": related_object.blob.name,
                        "url": reverse("blob:detail", kwargs={"uuid": related_object.blob.uuid}),
                        "note": related_object.note,
                        "edit_url": reverse("blob:update", kwargs={"uuid": related_object.blob.uuid}),
                        "cover_url": Blob.get_cover_url_static(
                            related_object.blob.uuid,
                            related_object.blob.file.name,
                            size="small"
                        )
                    }
                )
            elif related_object.bookmark:
                related_objects.append(
                    {
                        "bc_object_uuid": related_object.uuid,
                        "type": "bookmark",
                        "uuid": related_object.bookmark.uuid,
                        "name": related_object.bookmark.name,
                        "url": related_object.bookmark.url,
                        "cover_url": related_object.bookmark.thumbnail_url,
                        "cover_url_large": related_object.bookmark.cover_url,
                        "favicon_url": related_object.bookmark.get_favicon_img_tag(size=16),
                        "note": related_object.note,
                        "edit_url": reverse("bookmark:update", kwargs={"uuid": related_object.bookmark.uuid})
                    }
                )
            elif related_object.question:
                related_objects.append(
                    {
                        "bc_object_uuid": related_object.uuid,
                        "type": "question",
                        "uuid": related_object.uuid,
                        "question": related_object.question,
                        "note": related_object.note,
                    }
                )

        return related_objects

    @staticmethod
    def get_node_model(node_type: str) -> type[Model]:
        """Return the relation model class for the given node_type.

        Args:
            node_type: Type of node ("blob" or "drill").

        Returns:
            The relation model class (BlobToObject or QuestionToObject).

        Raises:
            ValueError: If node_type is not supported.
        """
        relation_models: dict[str, type[Model]] = {
            "blob": apps.get_model("blob", "BlobToObject"),
            "drill": apps.get_model("drill", "QuestionToObject"),
        }

        try:
            return relation_models[node_type]
        except KeyError as e:
            raise ValueError(f"Unsupported node_type: {node_type}") from e

    @staticmethod
    def back_references(uuid: UUID) -> list[dict[str, Any]]:
        """Find all objects that reference the blob or bookmark with the given UUID.

        Searches BlobToObject and QuestionToObject for relationships where
        the blob or bookmark UUID matches, and returns formatted information
        about the referencing objects.

        Args:
            uuid: UUID string of the blob or bookmark to find references for.

        Returns:
            List of dictionaries, each containing:
            - For blob references: type, name, cover_url, tags, url
            - For question references: type, question, tags, url
        """
        back_references = []

        QuestionToObject = apps.get_model("drill", "QuestionToObject")

        blob_to_objects = (
            BlobToObject.objects
            .filter(Q(blob__uuid=uuid) | Q(bookmark__uuid=uuid))
            .select_related("node")
            .prefetch_related("node__tags")
        )
        question_to_objects = (
            QuestionToObject.objects
            .filter(Q(blob__uuid=uuid) | Q(bookmark__uuid=uuid))
            .select_related("node")
        )

        if blob_to_objects:
            back_references.extend(
                [
                    {
                        "type": "blob",
                        "name": x.node.name,
                        "cover_url": x.node.get_cover_url(),
                        "tags": [tag.name for tag in x.node.tags.all()],
                        "url": reverse("blob:detail", args=[x.node.uuid]),
                    }
                    for x in blob_to_objects
                ]
            )
        if question_to_objects:
            back_references.extend(
                [
                    {
                        "type": "question",
                        "question": x.node.question,
                        "tags": [tag.name for tag in x.node.tags.all()],
                        "url": reverse("drill:detail", args=[x.node.uuid]),
                    }
                    for x in question_to_objects
                ]
            )

        return back_references

    def get_nodes(self) -> list[Any]:
        """Return all Node objects that reference this blob in their layout.

        Searches through all nodes owned by the blob's user and checks if
        this blob's UUID appears in the node's layout structure as a
        "collection" or "note" type entry.

        Returns:
            List of Node instances that reference this blob.
        """
        Node = apps.get_model("node", "Node")

        node_list = []

        for node in Node.objects.filter(user=self.user):
            if str(self.uuid) in [
                    val["uuid"]
                    for sublist in node.layout
                    for val in sublist
                    if "uuid" in val
                    and val["type"] in ["collection", "note"]
            ]:
                node_list.append(node)

        return node_list

    @staticmethod
    def is_ingestible_file(filename: str | Any) -> bool:
        """Check if a file can be ingested (processed for content extraction).

        Args:
            filename: Filename string or path.

        Returns:
            True if the file extension is in FILE_TYPES_TO_INGEST, False otherwise.
        """
        file_extension = PurePath(str(filename)).suffix
        return file_extension[1:].lower() in FILE_TYPES_TO_INGEST

    @staticmethod
    def get_cover_url_static(blob_uuid: UUID, filename: str, size: str = "large") -> str:
        """Generate the cover image URL for a blob.

        For large images, returns the image file URL directly. For other
        files or small sizes, returns the generated cover thumbnail URL.

        Args:
            blob_uuid: UUID of the blob.
            filename: Filename of the blob's file.
            size: Size variant ("large" or other). Defaults to "large".

        Returns:
            URL string for the cover image.
        """
        prefix = settings.COVER_URL + f"blobs/{blob_uuid}"
        s3_key = Blob.get_s3_key(blob_uuid, quote_plus(filename))

        if size != "large":
            url = f"{prefix}/cover.jpg"
        else:
            # Is the blob itself an image?
            if is_image(filename):
                # For the large version, use the image itself
                url = f"{settings.MEDIA_URL}{s3_key}"
            else:
                url = f"{prefix}/cover-{size}.jpg"

        return url

    def get_cover_url(self, size: str = "large") -> str:
        """Return the cover image URL for this blob.

        Args:
            size: Size variant ("large" or other). Defaults to "large".

        Returns:
            URL string for the cover image.
        """
        return Blob.get_cover_url_static(self.uuid, self.file.name, size)

    def clone(self, include_collections: bool = True) -> "Blob":
        """Create a copy of the current blob, including all its metadata and collection memberships.

        Creates a new blob with the same content, metadata, tags, and optionally
        collection memberships. The new blob is indexed in Elasticsearch.

        Args:
            include_collections: If True, add the cloned blob to the same
                collections as the original. Defaults to True.

        Returns:
            The newly created Blob instance.
        """
        new_blob = Blob.objects.create(
            content=self.content,
            name=f"Copy of {self.name}",
            user=self.user,
            date=self.date,
            importance=self.importance,
            is_note=self.is_note,
            math_support=self.math_support
        )

        for x in self.metadata.all():
            MetaData.objects.create(
                user=self.user,
                name=x.name,
                value=x.value,
                blob=new_blob)

        for tag in self.tags.all():
            new_blob.tags.add(tag)

        if include_collections:
            for co in CollectionObject.objects.filter(blob__uuid=self.uuid):
                if co.collection is not None:
                    co.collection.add_object(new_blob)

        # Add to Elasticsearch
        new_blob.index_blob()

        return new_blob

    def update_cover_image(self, image: bytes) -> None:
        """Upload and generate cover images for this blob.

        Uploads the provided image as both a large cover image and a small
        thumbnail (128x128) to S3, storing image dimensions in metadata.

        Args:
            image: Image bytes (JPEG format).
        """
        # Large cover image
        fo = io.BytesIO(image)
        large_width, large_height = Image.open(fo).size
        fo.seek(0)

        # Small cover image (128x128 thumbnail)
        fo_small = io.BytesIO(image)
        cover_image_small = Image.open(fo_small)
        cover_image_small.thumbnail((128, 128))
        small_width, small_height = cover_image_small.size
        buf_small = io.BytesIO()
        cover_image_small.save(buf_small, "jpeg")
        buf_small.seek(0)

        from blob.services import upload_blob_cover_images
        upload_blob_cover_images(
            str(self.uuid),
            fo,
            buf_small,
            (large_width, large_height),
            (small_width, small_height),
        )

    def update_page_number(self, page_number: int) -> None:
        """Update the PDF page number and trigger thumbnail regeneration.

        Stores the page number in the blob's data field and invokes a Lambda
        function to regenerate the thumbnail for the specified page.

        Args:
            page_number: Page number to set and generate thumbnail for.
        """
        if self.data is None:
            self.data = {"pdf_page_number": page_number}
        else:
            self.data["pdf_page_number"] = page_number
        self.save()

        from blob.services import invoke_create_thumbnail
        invoke_create_thumbnail(
            settings.AWS_STORAGE_BUCKET_NAME,
            str(self.uuid),
            str(self.file),
            page_number,
        )

    def rename_file(self, filename: str) -> None:
        """Rename a file, making the appropriate changes in the database and in S3.

        Copies the file to a new S3 key with the new filename, deletes the old
        file, and updates the blob's file field.

        Args:
            filename: New filename to use.

        Raises:
            ValidationError: If the S3 operation fails.
        """
        try:
            from blob.services import rename_blob_s3_file
            rename_blob_s3_file(str(self.uuid), self.file.name, filename)
        except Exception as e:
            raise ValidationError(f"Error renaming file: {e}") from e

        self.file.name = filename
        self.save()

    def index_blob(self, file_changed: bool = True, new_blob: bool = True) -> None:
        """Trigger Elasticsearch indexing for this blob via SNS.

        Publishes a message to SNS that will trigger a Lambda function to
        index the blob in Elasticsearch. The indexing happens asynchronously
        after the file is written to S3.

        Args:
            file_changed: Whether the file content has changed. Defaults to True.
            new_blob: Whether this is a newly created blob. Defaults to True.
        """
        from blob.services import publish_index_blob
        publish_index_blob(str(self.uuid), file_changed, new_blob)

    def get_tree(self) -> list[dict[str, Any]]:
        """Parse markdown headings from content and build a hierarchical tree structure.

        Scans the blob's content for markdown headings (#, ##, etc.) and builds
        a nested tree structure. Headings are numbered with IDs and inserted
        into the content with markers. Code blocks are skipped to avoid
        parsing comment-style headings.

        Returns:
            List of tree nodes, each containing id, label, and nested nodes.
            Returns empty list if content is empty.
        """
        def tree() -> Any:
            """Return a recursive defaultdict factory for building tree structures.

            Returns:
                A defaultdict factory that creates nested dictionaries.
            """
            return defaultdict(tree)

        if not self.content:
            return []

        content_out = ""

        nodes: dict[str, Any] = defaultdict(tree)

        nodes["label"] = "root"
        nodes["nodes"] = []  # Necessary?

        node_id = 1
        current_node = nodes
        current_level = None
        current_label = "root"

        top_level = None

        inside_code_block = False

        for line in self.content.split("\n"):

            if line.startswith("```"):
                inside_code_block = not inside_code_block

            # If we're inside a markdown code block, don't try to parse
            #  headings, since the '#s' that begin Python comments
            #  can cause confusion.
            if inside_code_block:
                content_out = f"{content_out}{line}\n"
                continue

            x = re.search(r"^(#+)(.*)", line.strip())
            if x:

                content_out = f"{content_out}%#@!{node_id}!@#%\n{line}\n"
                level = len(x.group(1))
                heading = x.group(2).strip()

                if not top_level:
                    top_level = level

                if not current_level:
                    # This is the first level encountered. Note: might not be 1.
                    current_label = heading
                    current_level = level

                if level > current_level:
                    for node in current_node["nodes"]:
                        if node["label"] == current_label:
                            node["nodes"].append(
                                {
                                    "id": node_id,
                                    "label": heading,
                                    "nodes": []
                                }
                            )
                            current_node = node

                elif current_level > level:

                    if level == top_level:
                        current_node = nodes
                    else:
                        current_node = nodes
                        for _ in range(level - top_level):
                            current_node = current_node["nodes"][-1]

                    current_node["nodes"].append(
                        {
                            "id": node_id,
                            "label": heading,
                            "nodes": []
                        }
                    )

                else:
                    current_node["nodes"].append(
                        {
                            "id": node_id,
                            "label": heading,
                            "nodes": []
                        }
                    )
                current_level = level
                current_label = heading
                node_id = node_id + 1

            else:
                content_out = f"{content_out}{line}\n"

        self.content = content_out

        return nodes["nodes"]

    def delete(self, using: Any | None = None, keep_parents: bool = False) -> tuple[int, dict[str, int]]:
        """Delete the blob and clean up associated resources.

        This method:
        - Deletes the blob from the database
        - Removes the blob from Elasticsearch (after transaction commits)
        - Deletes all files in the blob's S3 directory (after transaction commits)
        - Removes references from nodes
        - Invalidates user caches

        Cleanup operations (Elasticsearch and S3) are deferred until after the
        database transaction commits to ensure consistency. If the transaction
        rolls back, cleanup operations are not performed.

        Args:
            using: Database alias (unused).
            keep_parents: Whether to keep parent objects (unused).

        Returns:
            A tuple of (number of objects deleted, dict of deletion counts by model).
        """
        # Save values needed for cleanup before database deletion
        blob_uuid = str(self.uuid)
        user = self.user
        user_id = user.id
        has_file = bool(self.file)
        directory = f"{settings.MEDIA_ROOT}/{self.uuid}" if has_file else None

        # Delete from database first
        result = super().delete(using=using, keep_parents=keep_parents)

        # Cleanup operations that should happen after transaction commits
        def cleanups() -> None:
            # Delete from Elasticsearch
            try:
                delete_document(blob_uuid)
            except Exception as e:
                log.error("Failed to delete blob %s from Elasticsearch: %s", blob_uuid, e)

            # Delete from S3
            if has_file and directory:
                try:
                    from blob.services import delete_blob_s3_directory
                    delete_blob_s3_directory(blob_uuid)
                except Exception as e:
                    log.error("Failed to delete blob %s from S3: %s", blob_uuid, e)

        transaction.on_commit(cleanups)

        # These operations are safe to run before commit
        delete_note_from_nodes(user, blob_uuid)

        # After every blob mutation, invalidate the cache
        cache.delete(f"recent_blobs_{user_id}")
        cache.delete(f"recent_media_{user_id}")

        return result


class MetaData(TimeStampedModel):
    """Metadata key-value pair associated with a blob.

    Attributes:
        name: Metadata key name.
        value: Metadata value.
        blob: ForeignKey to the Blob this metadata belongs to.
        user: Owner of this metadata entry.
    """

    name = models.TextField()
    value = models.TextField()
    blob = models.ForeignKey(Blob, on_delete=models.CASCADE, related_name="metadata")
    user = models.ForeignKey(User, on_delete=models.PROTECT)

    def __str__(self) -> str:
        """Return string representation of the metadata.

        Returns:
            The metadata name.
        """
        return self.name

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("name", "value", "blob"),
                name="unique_metadata_name_value_blob",
            ),
        ]


class RecentlyViewedBlob(TimeStampedModel):
    """Tracks recently viewed blobs or nodes for a user.

    Maintains a history of recently viewed items, automatically limiting
    the list to MAX_SIZE entries per user.

    Attributes:
        uuid: Stable UUID identifier for this entry.
        blob: Optional ForeignKey to a Blob.
        node: Optional ForeignKey to a Node.
        MAX_SIZE: Maximum number of recent items to keep per user (20).
    """

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    blob = models.ForeignKey(Blob, null=True, on_delete=models.CASCADE)
    node = models.ForeignKey("node.Node", null=True, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    MAX_SIZE = 20

    def __str__(self) -> str:
        """Return string representation of the recently viewed item.

        Returns:
            The blob's name, node's name, or empty string if neither exists.
        """
        if self.blob:
            return self.blob.name or ""
        if self.node:
            return self.node.name or ""
        return ""

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user", "blob"),
                name="uniq_recent_blob_per_user",
            ),
            models.UniqueConstraint(
                fields=("user", "node"),
                name="uniq_recent_node_per_user",
            ),
        ]

    @staticmethod
    def add(user: User, blob: "Blob" | None = None, node: Any | None = None) -> None:
        """Add a blob or node to the user's recently viewed list.

        Removes any existing entries for the same blob/node to avoid
        duplicates, creates a new entry, and trims the list to MAX_SIZE
        by deleting the oldest entries.

        Args:
            user: User who viewed the item.
            blob: Optional Blob instance that was viewed.
            node: Optional Node instance that was viewed.
        """
        # Delete any previous rows containing this object to avoid duplicates
        RecentlyViewedBlob.objects.filter(blob=blob, node=None).delete()
        RecentlyViewedBlob.objects.filter(node=node, blob=None).delete()

        RecentlyViewedBlob.objects.create(user=user, blob=blob, node=node)

        # Insure that only MAX_SIZE blobs exist per user
        objects = RecentlyViewedBlob.objects.filter(
            Q(blob__user=user) | Q(node__user=user)
        ).only(
            "id"
        ).order_by(
            "-created"
        )[RecentlyViewedBlob.MAX_SIZE:]

        if objects:
            RecentlyViewedBlob.objects.filter(id__in=[x.id for x in objects]).delete()


class BlobToObject(SortOrderMixin):
    """Join/association between a Blob (as a node) and another object.

    This model is the through-table for many-to-many style relationships
    between Blobs acting as nodes and arbitrary "BCObject" entities
    (other Blobs, Bookmarks, Questions, etc.).

    Attributes:
        uuid: Stable UUID for this relationship row.
        node: The Blob acting as the node/container.
        blob: Optional Blob related to the node.
        bookmark: Optional Bookmark related to the node.
        question: Optional Question related to the node.
        bc_object: Generic BCObject reference.
        note: Free-form text annotation.
        sort_order: (inherited from SortOrderMixin) used for ordering.
    """

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    node = models.ForeignKey("blob.Blob", null=False, on_delete=models.CASCADE, related_name="nodes")
    blob = models.ForeignKey("blob.Blob", null=True, on_delete=models.CASCADE)
    bookmark = models.ForeignKey("bookmark.Bookmark", null=True, on_delete=models.CASCADE)
    question = models.ForeignKey("drill.Question", null=True, on_delete=models.CASCADE)
    bc_object = models.ForeignKey("blob.BCObject", on_delete=models.CASCADE, null=True)
    note = models.TextField(blank=True, null=True)

    field_name = "node"

    class Meta:
        ordering = ("sort_order",)
        constraints = [
            models.UniqueConstraint(
                fields=("node", "blob"),
                name="unique_blobtoobject_node_blob",
            ),
            models.UniqueConstraint(
                fields=("node", "bookmark"),
                name="unique_blobtoobject_node_bookmark",
            ),
            models.UniqueConstraint(
                fields=("node", "question"),
                name="unique_blobtoobject_node_question",
            ),
        ]

    def __str__(self) -> str:
        """Return string representation of this relationship.

        Returns:
            A string describing which object this node is linked to.
        """
        if self.blob:
            return f"{self.node} -> {self.blob}"
        if self.bookmark:
            return f"{self.node} -> {self.bookmark}"
        return f"{self.node} -> {self.question}"


class BCObject(TimeStampedModel):
    """Generic related object wrapper.

    This is a minimal model used to attach arbitrary objects to Blobs via
    BlobToObject. It inherits timestamp fields from TimeStampedModel.

    Attributes:
        uuid: Stable identifier for this object.
    """

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)


class BlobTemplate(TimeStampedModel):
    """Template for creating new blobs with predefined structure.

    Attributes:
        uuid: Stable UUID identifier for this template.
        name: Display name of the template.
        template: JSON field containing the template structure/data.
        user: Owner of this template.
    """

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    name = models.TextField()
    template = JSONField()
    user = models.ForeignKey(User, on_delete=models.PROTECT)

    def __str__(self) -> str:
        """Return string representation of the template.

        Returns:
            The template's name.
        """
        return self.name


@receiver(pre_delete, sender=BlobToObject)
def remove_relationship(sender: type[BlobToObject], instance: BlobToObject, **kwargs: Any) -> None:
    """Signal handler to clean up a BlobToObject before deletion.

    This delegates to the instance's `handle_delete()` so that any extra
    teardown logic (e.g., removing sort orders, unlinking files) runs.

    Args:
        sender: The model class (BlobToObject).
        instance: The BlobToObject instance being deleted.
        **kwargs: Additional signal metadata (unused).
    """
    instance.handle_delete()
