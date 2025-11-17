import json
import logging
import re
import uuid

import boto3
import isodate
import requests

from django import urls
from django.apps import apps
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import models
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
    """
    This custom field lets us use a checkbox on the form, which, if checked,
    results in a blob of JSON stored in the database rather than
    the usual boolean value.
    """
    def to_python(self, value):
        if value:
            return {"viewed": "false"}
        return None


class Bookmark(TimeStampedModel):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    url = models.URLField(max_length=1000, assume_scheme="https")
    name = models.TextField()
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    note = models.TextField(null=True)
    tags = models.ManyToManyField("tag.Tag")
    is_pinned = models.BooleanField(default=False)
    daily = DailyBookmarkJSONField(blank=True, null=True)
    last_check = models.DateTimeField(null=True)
    last_response_code = models.IntegerField(null=True)
    importance = models.IntegerField(default=1)
    data = JSONField(null=True, blank=True)

    created = models.DateTimeField(db_index=True, auto_now_add=True)

    objects = BookmarkManager()

    def __str__(self):
        return self.name

    def get_tags(self):
        return ", ".join([tag.name for tag in self.tags.all()])

    def save(self, *args, **kwargs):

        new_object = not self.id

        super().save(*args, **kwargs)

        # Only generate a cover image when the bookmark is first
        #  saved by checking for the existence of an id
        if new_object:
            self.generate_cover_image()

        # After every bookmark mutation, invalidate the cache
        cache.delete(f"recent_bookmarks_{self.user.id}")

    def delete(self):

        super().delete()

        # After every bookmark mutation, invalidate the cache
        cache.delete(f"recent_bookmarks_{self.user.id}")

        delete_document(self.uuid)

        self.delete_cover_image()

    def delete_tag(self, tag):

        s = TagBookmark.objects.get(tag=tag, bookmark=self)
        s.delete()
        self.tags.remove(tag)
        self.index_bookmark()

    def generate_cover_image(self):

        if self.url.startswith("https://www.youtube.com/watch"):
            self.generate_youtube_cover_image()
            return

        SNS_TOPIC = settings.SNS_TOPIC_ARN
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
            TopicArn=SNS_TOPIC,
            Message=json.dumps(message),
        )

    def generate_youtube_cover_image(self):
        """
        Use Google's Youtube API to get the video's thumbnail url.
        Download it and store in S3.
        """

        m = re.search(r"https://www.youtube.com/watch\?v=(.*)", self.url)
        if m:
            youtube_id = m.group(1)
            api_key = settings.GOOGLE_API_KEY

            r = requests.get(f"https://www.googleapis.com/youtube/v3/videos?id={youtube_id}&key={api_key}&part=snippet,contentDetails,statistics")
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

            r = requests.get(video_info["items"][0]["snippet"]["thumbnails"]["medium"]["url"])
            s3_object = s3_resource.Object(bucket_name, f"bookmarks/{self.uuid}.jpg")
            s3_object.put(
                Body=r.content,
                ContentType="image/jpeg",
                ACL="public-read",
                CacheControl=f"max-age={MAX_AGE}",
                Metadata={"cover-image": "Yes"}
            )

    def delete_cover_image(self):
        """
        After deletion, remove the bookmark's cover images from S3
        """

        s3 = boto3.resource("s3")

        key = f"bookmarks/{self.uuid}.png"
        s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key).delete()

        key = f"bookmarks/{self.uuid}-small.png"
        s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key).delete()

        key = f"bookmarks/{self.uuid}.jpg"
        s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key).delete()

    def index_bookmark(self, es=None):
        index_document(self.elasticsearch_document)

    @property
    def cover_url(self):
        return f"{settings.COVER_URL}bookmarks/{self.uuid}.png"

    def thumbnail_url_static(bookmark_uuid, url):
        prefix = f"{settings.COVER_URL}bookmarks"

        if url.startswith("https://www.youtube.com/watch"):
            return f"{prefix}/{bookmark_uuid}.jpg"
        return f"{prefix}/{bookmark_uuid}-small.png"

    @property
    def thumbnail_url(self):
        return Bookmark.thumbnail_url_static(self.uuid, self.url)

    @property
    def video_duration(self):

        if self.data and "video_duration" in self.data:
            return convert_seconds(self.data["video_duration"])
        return ""

    @property
    def elasticsearch_document(self):
        """
        Return a representation of the bookmark suitable for indexing in Elasticsearch
        """

        return {
            "_index": settings.ELASTICSEARCH_INDEX,
            "_id": self.uuid,
            "_source": {
                "bordercore_id": self.id,
                "name": self.name,
                "tags": [tag.name for tag in self.tags.all()],
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

    def snarf_favicon(self):

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

    def get_favicon_url(self, size=32):
        return Bookmark.get_favicon_url_static(self.url, size)

    @staticmethod
    def get_favicon_url_static(url, size=32):

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

    def related_nodes(self):
        """
        Return a list of nodes with collections containing this bookmark
        """

        Node = apps.get_model("node", "Node")

        found_nodes = set()

        for so in self.collectionobject_set.all().select_related("collection"):
            for node in Node.objects.filter(user=self.user):
                for col in node.layout:
                    found = [x for x in col if "uuid" in x and x["uuid"] == str(so.collection.uuid)]
                    if found:
                        found_nodes.add(node)

        return [
            {
                "name": x.name,
                "url": urls.reverse("node:detail", kwargs={"uuid": x.uuid}),
                "uuid": x.uuid
            }
            for x in
            found_nodes
        ]


def tags_changed(sender, **kwargs):

    if kwargs["action"] == "post_add":
        bookmark = kwargs["instance"]

        for tag_id in kwargs["pk_set"]:
            so = TagBookmark(tag=Tag.objects.get(pk=tag_id), bookmark=bookmark)
            so.save()


m2m_changed.connect(tags_changed, sender=Bookmark.tags.through)
