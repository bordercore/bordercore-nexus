import datetime
import hashlib
import io
import json
import logging
import re
import uuid
from collections import defaultdict
from datetime import timedelta
from pathlib import PurePath
from typing import Tuple
from urllib.parse import quote_plus, urlparse

import boto3
import humanize
from PIL import Image
from storages.backends.s3boto3 import S3Boto3Storage

from django.apps import apps
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import models
from django.db.models import Count, JSONField, Model, Q
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.forms import ValidationError
from django.urls import reverse

from bookmark.models import Bookmark
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

    # Override this to prevent Django from cleaning the name (eg replacing spaces with underscores)
    def get_valid_name(self, name):
        return name


class Blob(TimeStampedModel):
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
        unique_together = (
            ("sha1sum", "user")
        )

    def __str__(self):
        return self.name or ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Save the filename so that when it changes by a blob edit
        #  in save() we know what the original was.
        setattr(self, "__original_filename", self.file.name)

    @staticmethod
    def get_content_type(argument):
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
    def get_duration_humanized(duration):
        duration = str(datetime.timedelta(seconds=int(duration)))

        # Remove any leading "0:0" or "0:"
        duration = re.sub(r"^(0\:0)|^0\:", "", duration)

        return duration

    def get_parent_dir(self):
        return f"{settings.MEDIA_ROOT}/{self.uuid}"

    def get_tags(self):
        return ", ".join(sorted([tag.name for tag in self.tags.all()]))

    def get_url(self):
        return f"{self.uuid}/{quote_plus(str(self.file))}"

    def get_name(self, remove_edition_string=False, use_filename_if_present=False):
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

    def get_edition_string(self):
        if self.name:
            pattern = re.compile(r"(.*) (\d)E$")
            matches = pattern.match(self.name)
            if matches and EDITIONS.get(matches.group(2), None):
                return f"{EDITIONS[matches.group(2)]} Edition"

        return ""

    @property
    def doctype(self):
        if self.is_note is True:
            return "note"
        if "is_book" in [x.name for x in self.metadata.all()]:
            return "book"
        if is_image(self.file):
            return "image"
        if is_video(self.file):
            return "video"
        if self.sha1sum is not None:
            return "blob"
        return "document"

    @property
    def s3_key(self):
        if self.file:
            return Blob.get_s3_key(self.uuid, self.file)
        return None

    @property
    def date_is_year(self):
        if not self.date:
            return False
        return bool(re.fullmatch(r"\d{4}", self.date))

    @staticmethod
    def get_s3_key(uuid, file):
        return f"{settings.MEDIA_ROOT}/{uuid}/{file}"

    def get_metadata(self):

        metadata = {}
        urls = []

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

    def get_elasticsearch_info(self):

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

        results = es.search(index=settings.ELASTICSEARCH_INDEX, body=query)["hits"]["hits"][0]

        if "content_type" in results["_source"]:
            results["_source"]["content_type"] = Blob.get_content_type(results["_source"]["content_type"])

        if "size" in results["_source"]:
            results["_source"]["size"] = humanize.naturalsize(results["_source"]["size"])

        if "duration" in results["_source"]:
            results["_source"]["duration"] = Blob.get_duration_humanized(results["_source"]["duration"])

        return {**results["_source"], "id": results["_id"]}

    def save(self, *args, **kwargs):

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

                key = f"{self.get_parent_dir()}/{filename_orig}"
                log.info("Blob file changed detected. Deleting old file: %s", key)
                log.info("%s != %s", sha1sum_old, self.sha1sum)
                s3 = boto3.resource("s3")
                s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key).delete()

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

    def set_s3_metadata_file_modified(self):
        """
        Store a file's modification time as S3 metadata after it's saved.
        """

        s3 = boto3.resource("s3")
        key = self.s3_key

        s3_object = s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key)

        s3_object.metadata.update({"file-modified": str(self.file_modified)})

        # Note: since "Content-Type" is system-defined metadata, it will be reset
        #  to "binary/octent-stream" if you don't explicitly specify it.
        s3_object.copy_from(
            ContentType=s3_object.content_type,
            CopySource={"Bucket": settings.AWS_STORAGE_BUCKET_NAME, "Key": key},
            Metadata=s3_object.metadata,
            MetadataDirective="REPLACE"
        )

    def has_been_modified(self):
        """
        If the modified time is greater than the creation time by
        more than one second, assume it has been edited.
        """
        return self.modified - self.created > timedelta(seconds=1)

    @staticmethod
    def related_objects(app, model, base_object):

        model = apps.get_model(app, model)

        related_objects = []

        for related_object in model.objects.filter(node=base_object).exclude(note="sql").select_related("bookmark").select_related("blob"):
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
    def get_node_model(node_type: str) -> type:
        """
        Return the relation model class for the given node_type, or raise ValueError.
        """
        from typing import Dict, Type
        RELATION_MODELS: Dict[str, Type[Model]] = {
            "blob": apps.get_model("blob", "BlobToObject"),
            "drill": apps.get_model("drill", "QuestionToObject"),
        }

        try:
            return RELATION_MODELS[node_type]
        except KeyError as e:
            raise ValueError(f"Unsupported node_type: {node_type}") from e

    @staticmethod
    def add_related_object(node_type: str, node_uuid: str, object_uuid: str) -> Tuple[dict, int]:
        """
        Relates a node to another object

        Args:
            node_type: Type of the node (e.g., "blob", "drill").
            node_uuid: UUID of the node.
            object_uuid: UUID of the related object (Blob or Bookmark).

        Returns:
            tuple[dict, int]: JSON response and HTTP status code.
        """
        Question = apps.get_model("drill", "Question")

        # Resolve models
        try:
            relation_model = Blob.get_node_model(node_type)
        except ValueError as e:
            return {"status": "Error", "message": str(e)}, 400

        node_models = {
            "blob": Blob,
            "drill": Question,
        }

        node_model = node_models.get(node_type)
        node = node_model.objects.filter(uuid=node_uuid).first()
        if not node:
            return {"status": "Error", "message": "Node not found"}, 404

        # Find the target object (Blob takes precedence)
        target = (
            Blob.objects.filter(uuid=object_uuid).first()
            or Bookmark.objects.filter(uuid=object_uuid).first()
        )
        if not target:
            return {"status": "Error", "message": "Related object not found"}, 400

        # Derive relation field name from the model’s class name
        model_key = target.__class__.__name__.lower()
        relation_kwargs = {model_key: target}

        # get_or_create to simplify exists/create
        _, created = relation_model.objects.get_or_create(
            node=node, **relation_kwargs
        )
        if not created:
            return {"status": "Error", "message": "That object is already related"}, 400

        return {"status": "OK"}, 200

    @staticmethod
    def back_references(uuid):

        back_references = []

        QuestionToObject = apps.get_model("drill", "QuestionToObject")

        blob_to_objects = BlobToObject.objects.filter(Q(blob__uuid=uuid) | Q(bookmark__uuid=uuid)).select_related("node")
        question_to_objects = QuestionToObject.objects.filter(Q(blob__uuid=uuid) | Q(bookmark__uuid=uuid)).select_related("node")

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

    def get_nodes(self):

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

    def is_image(self):
        return is_image(self.file)

    def is_video(self):
        return is_video(self.file)

    def is_audio(self):
        return is_audio(self.file)

    def is_pdf(self):
        return is_pdf(self.file)

    def is_pinned_note(self):
        return self in self.user.userprofile.pinned_notes.all()

    def get_collections(self):
        collection_list = []

        for x in CollectionObject.objects.filter(
                blob=self,
                collection__user=self.user
        ).annotate(
            num_objects=Count("collection__collectionobject")
        ).prefetch_related(
            "collection"
        ):
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

    def get_date(self):
        return get_date_from_pattern({"gte": self.date})

    @staticmethod
    def is_ingestible_file(filename):

        file_extension = PurePath(str(filename)).suffix
        return file_extension[1:].lower() in FILE_TYPES_TO_INGEST

    def get_cover_url_static(blob_uuid, filename, size="large"):

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

    def get_cover_url(self, size="large"):
        return Blob.get_cover_url_static(self.uuid, self.file.name, size)

    def get_cover_url_small(self):
        return self.get_cover_url(size="small")

    def clone(self, include_collections=True):
        """
        Create a copy of the current blob, including all its metadata and
        collection memberships.
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
            for so in CollectionObject.objects.filter(blob__uuid=self.uuid):
                so.collection.add_object(new_blob)

        # Add to Elasticsearch
        new_blob.index_blob()

        return new_blob

    def update_cover_image(self, image):

        s3_client = boto3.client("s3")

        key = f"blobs/{self.uuid}/cover-large.jpg"
        fo = io.BytesIO(image)
        width, height = Image.open(fo).size
        fo.seek(0)

        s3_client.upload_fileobj(
            fo,
            settings.AWS_STORAGE_BUCKET_NAME,
            key,
            ExtraArgs={"Metadata": {"image-width": str(width),
                                    "image-height": str(height),
                                    "cover-image": "Yes"},
                       "ContentType": "image/jpeg"}
        )

        key = f"blobs/{self.uuid}/cover.jpg"
        fo = io.BytesIO(image)
        cover_image_small = Image.open(fo)

        size = 128, 128
        cover_image_small.thumbnail(size)
        width, height = cover_image_small.size
        fo = io.BytesIO()
        cover_image_small.save(fo, "jpeg")
        fo.seek(0)

        s3_client.upload_fileobj(
            fo,
            settings.AWS_STORAGE_BUCKET_NAME,
            key,
            ExtraArgs={"Metadata": {"image-width": str(width),
                                    "image-height": str(height),
                                    "cover-image": "Yes"},
                       "ContentType": "image/jpeg"}
        )

    def update_page_number(self, page_number):

        if self.data is None:
            self.data = {"pdf_page_number": page_number}
        else:
            self.data["pdf_page_number"] = page_number
        self.save()

        message = {
            "Records": [
                {
                    "eventName": "ObjectCreated: Put",
                    "s3": {
                        "bucket": {
                            "name": settings.AWS_STORAGE_BUCKET_NAME,
                        },
                        "object": {
                            "key": f"blobs/{self.uuid}/{self.file}",
                            "page_number": page_number
                        }
                    }
                }
            ]
        }

        payload = {
            "Records": [
                {
                    "Sns": {
                        "Message": json.dumps(message)
                    }
                }
            ]
        }

        client = boto3.client("lambda")

        client.invoke(
            FunctionName="CreateThumbnail",
            InvocationType="Event",
            Payload=json.dumps(payload)
        )

    def rename_file(self, filename):
        """
        Rename a file, making the appropriate changes in the database and in S3.
        """

        try:
            s3 = boto3.resource("s3")
            key_root = f"{settings.MEDIA_ROOT}/{self.uuid}"
            s3.Object(
                settings.AWS_STORAGE_BUCKET_NAME, f"{key_root}/{filename}"
            ).copy_from(
                CopySource=f"{settings.AWS_STORAGE_BUCKET_NAME}/{key_root}/{self.file.name}"
            )
            s3.Object(settings.AWS_STORAGE_BUCKET_NAME, f"{key_root}/{self.file.name}").delete()
        except Exception as e:
            raise ValidationError(f"Error renaming file: {e}")

        self.file.name = filename
        self.save()

    def index_blob(self, file_changed=True, new_blob=True):
        """
        Index the blob into Elasticsearch, but only if there is no
        file associated with it. If there is, then a lambda will be
        triggered once it's written to S3 to do the indexing
        """

        client = boto3.client("sns")

        message = {
            "Records": [
                {
                    "s3": {
                        "bucket": {
                            "name": settings.AWS_STORAGE_BUCKET_NAME
                        },
                        "uuid": str(self.uuid),
                        "file_changed": file_changed,
                        "new_blob": new_blob
                    }
                }
            ]
        }

        client.publish(
            TopicArn=settings.INDEX_BLOB_TOPIC_ARN,
            Message=json.dumps(message),
        )

    def tree(self):
        return defaultdict(self.tree)

    def get_tree(self):

        if not self.content:
            return []

        content_out = ""

        nodes = defaultdict(self.tree)

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

    def delete(self):

        # Delete from Elasticsearch
        delete_document(str(self.uuid))
        super().delete()

        # Delete from S3
        if self.file:

            directory = f"{settings.MEDIA_ROOT}/{self.uuid}"
            s3 = boto3.resource("s3")
            my_bucket = s3.Bucket(settings.AWS_STORAGE_BUCKET_NAME)

            for fn in my_bucket.objects.filter(Prefix=directory):
                log.info("Deleting blob %s", fn)
                fn.delete()

            # Pass false so FileField doesn't save the model.
            self.file.delete(False)

        delete_note_from_nodes(self.user, self.uuid)

        # After every blob mutation, invalidate the cache
        cache.delete(f"recent_blobs_{self.user.id}")
        cache.delete(f"recent_media_{self.user.id}")


class MetaData(TimeStampedModel):
    name = models.TextField()
    value = models.TextField()
    blob = models.ForeignKey(Blob, on_delete=models.CASCADE, related_name="metadata")
    user = models.ForeignKey(User, on_delete=models.PROTECT)

    def __str__(self):
        return self.name

    class Meta:
        unique_together = ("name", "value", "blob")


class RecentlyViewedBlob(TimeStampedModel):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    blob = models.ForeignKey(Blob, null=True, on_delete=models.CASCADE)
    node = models.ForeignKey("node.Node", null=True, on_delete=models.CASCADE)

    MAX_SIZE = 20

    def __str__(self):
        return self.blob.name or self.node.name or ""

    class Meta:
        unique_together = (
            ("blob", "node")
        )

    @staticmethod
    def add(user, blob=None, node=None):

        # Delete any previous rows containing this object to avoid duplicates
        RecentlyViewedBlob.objects.filter(blob=blob, node=None).delete()
        RecentlyViewedBlob.objects.filter(node=node, blob=None).delete()

        RecentlyViewedBlob.objects.create(blob=blob, node=node)

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
        unique_together = (
            ("node", "blob"),
            ("node", "bookmark"),
            ("node", "question")
        )

    def __str__(self):
        if self.blob:
            return f"{self.node} -> {self.blob}"
        if self.bookmark:
            return f"{self.node} -> {self.bookmark}"
        return f"{self.node} -> {self.question}"


class BCObject(TimeStampedModel):

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)


class BlobTemplate(TimeStampedModel):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    name = models.TextField()
    template = JSONField()
    user = models.ForeignKey(User, on_delete=models.PROTECT)

    def __str__(self):
        return self.name


@receiver(pre_delete, sender=BlobToObject)
def remove_relationship(sender, instance, **kwargs):
    instance.handle_delete()
