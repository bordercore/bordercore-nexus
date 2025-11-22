"""
Models for the collection system.

This module defines Collection (a user-created grouping of Blobs and Bookmarks),
CollectionObject (the through-table linking Collections to their contents), and
BCObject (a generic base for related objects). Collections support tags, favorites,
thumbnails, and paginated browsing of their contents.
"""

from __future__ import unicode_literals

import datetime
import json
import logging
import re
import uuid
from typing import TYPE_CHECKING, Any

import boto3

from django.conf import settings
from django.contrib.auth.models import User
from django.core.paginator import Paginator
from django.db import models
from django.db.models import F, Q
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.http import HttpRequest
from django.urls import reverse

if TYPE_CHECKING:
    from blob.models import Blob
    from bookmark.models import Bookmark

from lib.exceptions import DuplicateObjectError
from lib.mixins import SortOrderMixin, TimeStampedModel
from tag.models import Tag

log = logging.getLogger(f"bordercore.{__name__}")

BLOB_COUNT_PER_PAGE = 30


class Collection(TimeStampedModel):
    """
    A user-created grouping of Blobs and Bookmarks organized around a theme.

    Collections allow users to organize their content (Blobs and Bookmarks) into
    logical groups. Each Collection can have tags, a description, favorite status,
    and automatically generates a thumbnail cover image. Collections support
    paginated browsing, filtering by tags, and random ordering of contents.
    """

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    bc_objects: models.ManyToManyField = models.ManyToManyField("collection.BCObject", through="CollectionObject")
    tags = models.ManyToManyField(Tag)
    description = models.TextField(blank=True, default="")
    is_favorite = models.BooleanField(default=False)

    def __str__(self) -> str:
        """Return string representation of the collection.

        Returns:
            The name of the collection.
        """
        return self.name

    def get_absolute_url(self) -> str:
        """Return the canonical URL for viewing this collection.

        Returns:
            The detail page URL for this collection.
        """
        return reverse("collection:detail", kwargs={"uuid": self.uuid})

    @property
    def cover_url(self) -> str:
        """Return the URL for this collection's thumbnail cover image.

        Returns:
            The S3 URL path to the collection's cover thumbnail.
        """
        return f"{settings.COVER_URL}collections/{self.uuid}.jpg"

    def add_object(self, object: "Blob | Bookmark") -> None:
        """Add a Blob or Bookmark to this collection.

        Creates a CollectionObject linking this collection to the provided object.
        If the object is already in the collection, raises DuplicateObjectError.
        After adding, updates the collection's modified timestamp and regenerates
        the thumbnail.

        Args:
            object: A Blob or Bookmark instance to add to the collection.

        Raises:
            DuplicateObjectError: If the object is already in this collection.
            ValueError: If the object is not a Blob or Bookmark.
        """
        from blob.models import Blob
        from bookmark.models import Bookmark

        if isinstance(object, Bookmark):
            if CollectionObject.objects.filter(collection=self, bookmark=object).exists():
                raise DuplicateObjectError
            so = CollectionObject(collection=self, bookmark=object)
        elif isinstance(object, Blob):
            if CollectionObject.objects.filter(collection=self, blob=object).exists():
                raise DuplicateObjectError
            so = CollectionObject(collection=self, blob=object)
        else:
            raise ValueError(f"Unsupported type: {type(object)}")
        so.save()

        self.modified = datetime.datetime.now()
        self.save()

        self.create_collection_thumbnail()

    def remove_object(self, object_uuid: str) -> None:
        """Remove a Blob or Bookmark from this collection by UUID.

        Finds the CollectionObject linking this collection to the object with the
        given UUID and deletes it. Updates the collection's modified timestamp
        and regenerates the thumbnail.

        Args:
            object_uuid: The UUID (as string) of the Blob or Bookmark to remove.

        Raises:
            CollectionObject.DoesNotExist: If no object with that UUID exists
                in this collection.
        """
        so = CollectionObject.objects.get(
            Q(blob__uuid=object_uuid) | Q(bookmark__uuid=object_uuid),
            collection__uuid=self.uuid
        )
        so.delete()

        self.modified = datetime.datetime.now()
        self.save()

        self.create_collection_thumbnail()

    def delete(
            self,
            using: Any | None = None,
            keep_parents: bool = False,
    ) -> tuple[int, dict[str, int]]:
        """Delete this collection and its S3 thumbnail.

        Before deletion, removes the collection's cover thumbnail image from S3.
        Then calls the superclass delete to remove the collection and cascade
        delete all related CollectionObjects.

        Args:
            using: Database alias (unused).
            keep_parents: Whether to keep parent objects (unused).

        Returns:
            A tuple of (number of objects deleted, dict of deletion counts by model).
        """
        # Delete the collection's thumbnail image in S3
        s3 = boto3.resource("s3")
        s3.Object(settings.AWS_STORAGE_BUCKET_NAME, f"collections/{self.uuid}.jpg").delete()

        return super().delete(using=using, keep_parents=keep_parents)

    def get_tags(self) -> str:
        """Return a comma-separated string of this collection's tag names.

        Returns:
            Comma-separated human-readable list of tag names.
        """
        return ", ".join([tag.name for tag in self.tags.all()])

    def get_blob(self, position: int, direction: str, randomize: bool = False, tag_name: str | None = None) -> dict[str, str | None | int] | None:
        """Return metadata for a Blob in this collection by position or direction.

        Retrieves a Blob from the collection's contents, optionally filtered by
        tag. Can return a random Blob, or navigate forward/backward from a given
        position. Wraps around at the ends of the list.

        Args:
            position: Current index into the filtered list of Blobs.
            direction: Either "next" or "previous" for sequential navigation.
                Ignored if randomize=True.
            randomize: If True, return a random Blob instead of using position/direction.
            tag_name: Optional tag name to filter the collection's Blobs.

        Returns:
            A dict containing:
            - "url": Media URL path to the Blob file.
            - "content_type": MIME type of the Blob (if available).
            - "index": The position index of the returned Blob.
            Returns None if the CollectionObject has no associated Blob.
        """
        so = CollectionObject.objects.filter(
            collection=self
        ).select_related(
            "blob"
        ).select_related(
            "blob__user"
        )

        if tag_name:
            so = so.filter(blob__tags__name=tag_name)

        # Filter to only CollectionObjects that have a blob (not bookmarks)
        so = so.filter(blob__isnull=False)

        count = len(so)

        if randomize:
            blob = so.order_by("?")[0]
        else:
            if direction == "next":
                position = 0 if position == count - 1 else position + 1
            elif direction == "previous":
                position = count - 1 if position == 0 else position - 1
            blob = so[position]

        if blob.blob is None:
            return None

        blob_obj = blob.blob

        content_type = None
        try:
            content_type = blob_obj.get_elasticsearch_info()["content_type"]
        except Exception:
            log.warning("Can't get content type for uuid=%s", blob_obj.uuid)

        return {
            "url": f"{settings.MEDIA_URL}blobs/{blob_obj.get_url()}",
            "content_type": content_type,
            "index": position
        }

    def get_object_list(self, request: HttpRequest | None = None, limit: int = BLOB_COUNT_PER_PAGE, page_number: int = 1, random_order: bool = False) -> dict[str, Any]:
        """Return a paginated list of objects in this collection.

        Retrieves the collection's contents (Blobs and Bookmarks) with optional
        tag filtering and random ordering. Returns pagination metadata along with
        the object list for rendering collection detail pages.

        Args:
            request: Optional Django request object. If provided, extracts "tag"
                and "page" query parameters.
            limit: Number of objects per page.
            page_number: Which page to return (1-indexed).
            random_order: If True, randomize the order of objects.

        Returns:
            A dict containing:
            - "object_list": List of dicts, each with object properties (uuid,
              name, url, cover_url, etc.) plus any note from CollectionObject.
            - "paginator": Dict with pagination info (page_number, has_next,
              has_previous, next_page_number, previous_page_number, count).
        """
        object_list = []

        queryset = CollectionObject.objects.filter(
            collection=self
        ).prefetch_related(
            "blob"
        ).prefetch_related(
            "bookmark"
        )

        if request and "tag" in request.GET:
            queryset = queryset.filter(blob__tags__name=request.GET["tag"])

        if random_order:
            queryset = queryset.order_by("?")

        if request and "page" in request.GET:
            try:
                page_number = int(request.GET["page"])
            except (ValueError, TypeError):
                page_number = 1

        paginator = Paginator(queryset, limit)
        page = paginator.page(page_number)

        for so_object in page.object_list:
            object_list.append({
                "note": so_object.note,
                **so_object.get_properties()
            })

        paginator_info = {
            "page_number": page_number,
            "has_next": page.has_next(),
            "has_previous": page.has_previous(),
            "next_page_number": page.next_page_number() if page.has_next() else None,
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "count": paginator.count
        }

        return {
            "object_list": object_list,
            "paginator": paginator_info
        }

    def get_recent_images(self, limit: int = 4) -> Any:
        """Return a QuerySet of the most recent images added to this collection.

        Queries CollectionObjects in this collection that reference Blobs with
        image-like file extensions, ordered by creation date descending. Returns
        a lazy QuerySet that yields dicts when iterated.

        Args:
            limit: Maximum number of images to return.

        Returns:
            A QuerySet of dicts, each containing "uuid" and "file" fields from
            the most recently created image Blobs. The QuerySet is lazy and
            will be evaluated when iterated or converted to a list.
        """
        queryset = self.collectionobject_set.filter(
            blob__file__iregex=r"\.(gif|jpg|jpeg|pdf|png)$"
        ).values(
            uuid=F("blob__uuid"),
            file=F("blob__file")
        ).order_by(
            "-blob__created"
        )[:limit]
        return queryset

    def create_collection_thumbnail(self) -> None:
        """Trigger generation of a new cover thumbnail for this collection.

        Publishes an SNS message to the collection thumbnail creation topic,
        which triggers an AWS Lambda function to generate a fresh cover image
        based on the collection's current contents.
        """
        # Generate a fresh cover image for the collection
        client = boto3.client("sns")

        message = {
            "Records": [
                {
                    "s3": {
                        "bucket": {
                            "name": settings.AWS_STORAGE_BUCKET_NAME,
                        },
                        "collection_uuid": str(self.uuid)
                    }
                }
            ]
        }

        client.publish(
            TopicArn=settings.CREATE_COLLECTION_THUMBNAIL_TOPIC_ARN,
            Message=json.dumps(message),
        )


class CollectionObject(SortOrderMixin):
    """Join/association between a Collection and its contents (Blob or Bookmark).

    This model is the through-table linking Collections to their Blob and Bookmark
    contents. Each CollectionObject represents one item in a collection and maintains
    a sort_order for custom ordering. A CollectionObject must reference exactly one
    of blob or bookmark (not both, not neither).

    Attributes:
        collection: The Collection this object belongs to.
        blob: Optional Blob in this collection.
        bookmark: Optional Bookmark in this collection.
        object: Optional generic BCObject reference.
        created: Timestamp when this object was added to the collection.
        sort_order: (inherited from SortOrderMixin) used for ordering items.
    """

    collection = models.ForeignKey("collection.Collection", null=True, on_delete=models.CASCADE)
    blob = models.ForeignKey("blob.Blob", null=True, on_delete=models.CASCADE)
    bookmark = models.ForeignKey("bookmark.Bookmark", null=True, on_delete=models.CASCADE)
    object = models.ForeignKey("collection.BCObject", on_delete=models.CASCADE, null=True)
    created = models.DateTimeField(auto_now_add=True)

    field_name = "collection"

    class Meta:
        ordering = ("sort_order",)
        unique_together = (
            ("collection", "blob", "bookmark")
        )

    def __str__(self) -> str:
        """Return string representation of this collection object.

        Returns:
            A string describing the collection and its linked object.
        """
        return f"SortOrder: {self.collection}, {self.blob}, {self.bookmark}"

    def get_object_type(self) -> str:
        """Return the type of object this CollectionObject references.

        Returns:
            Either "blob", "bookmark", or "unknown" depending on which foreign
            key is set.
        """
        if self.blob is not None:
            return "blob"
        if self.bookmark is not None:
            return "bookmark"
        return "unknown"

    def get_properties(self) -> dict[str, Any]:
        """Return a dict of properties for the linked Blob or Bookmark.

        Extracts relevant fields (uuid, name, url, cover URLs, etc.) from the
        linked object and formats them for display in collection views.

        Returns:
            A dict containing object metadata:
            - "so_id": This CollectionObject's ID.
            - "type": Object type ("blob" or "bookmark").
            - "id", "uuid", "name", "url": Standard object identifiers.
            - For Blobs: "filename", "sha1sum", "cover_url", "cover_url_large".
            - For Bookmarks: "favicon_url".

        Raises:
            ValueError: If neither blob nor bookmark is set.
        """
        if self.blob is not None:
            return {
                "so_id": self.id,
                "type": self.get_object_type(),
                "id": self.blob.id,
                "uuid": self.blob.uuid,
                "filename": self.blob.file.name,
                "name": re.sub("[\n\r]", "", self.blob.name) if self.blob.name else "",
                "url": reverse("blob:detail", kwargs={"uuid": self.blob.uuid}),
                "sha1sum": self.blob.sha1sum,
                "cover_url": self.blob.get_cover_url_small(),
                "cover_url_large": self.blob.get_cover_url(),
            }
        if self.bookmark is not None:
            return {
                "so_id": self.id,
                "type": self.get_object_type(),
                "id": self.bookmark.id,
                "uuid": self.bookmark.uuid,
                "name": self.bookmark.name,
                "url": self.bookmark.url,
                "favicon_url": self.bookmark.get_favicon_url(size=16)
            }
        raise ValueError(f"Unsupported object: {self}")


class BCObject(TimeStampedModel):
    """Generic related object wrapper.

    This is a minimal model used to attach arbitrary objects to Collections via
    CollectionObject. It inherits timestamp fields from TimeStampedModel.

    Attributes:
        uuid: Stable identifier for this object.
    """

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)


@receiver(pre_delete, sender=CollectionObject)
def remove_object(sender: type[CollectionObject], instance: CollectionObject, **kwargs: Any) -> None:
    """Signal handler to clean up a CollectionObject before deletion.

    This delegates to the instance's `handle_delete()` so that any extra
    teardown logic (e.g. removing sort orders, updating collection timestamps)
    runs.

    Args:
        sender: The model class (CollectionObject).
        instance: The CollectionObject instance being deleted.
        **kwargs: Additional signal metadata (unused).
    """
    instance.handle_delete()
