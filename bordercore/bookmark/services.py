"""
Bookmark Services Module

This module provides service functions for handling bookmark-related operations
with caching support and AWS interactions.
"""

from collections.abc import Iterable
from typing import Any

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import transaction
from django.urls import reverse

from bookmark.models import Bookmark
from lib.aws import lambda_invoke_async, s3_delete_object, s3_put_object, sns_publish
from lib.constants import S3_CACHE_MAX_AGE_SECONDS
from tag.models import Tag, TagBookmark


def save_bookmark_with_tags(bookmark: Bookmark, tags: Iterable[Tag]) -> None:
    """Persist a bookmark, replace its tags, then index it and fetch its favicon.

    This is the shared post-validation save path for the bookmark create/update
    form views and the JSON create API, keeping their behaviour from drifting.
    Within a single transaction it saves the bookmark, removes any existing tag
    associations (including the TagBookmark tracking rows, which the m2m_changed
    signal does not clean up on removal), and re-adds the supplied tags. After
    the transaction commits the bookmark is reindexed in Elasticsearch and an
    asynchronous favicon fetch is triggered.

    Args:
        bookmark: The Bookmark to save. Its ``user`` must already be set.
        tags: The tags to associate with the bookmark, replacing any existing ones.
    """
    with transaction.atomic():
        bookmark.save()
        TagBookmark.objects.filter(bookmark=bookmark).delete()
        bookmark.tags.clear()
        for tag in tags:
            bookmark.tags.add(tag)

    bookmark.index_bookmark()
    bookmark.snarf_favicon()


def get_recent_bookmarks(user: User, limit: int = 10) -> list[dict[str, Any]]:
    """
    Return a list of recently created bookmarks for a specific user.
    Results are cached per user to improve performance.

    Args:
        user: The user object to get bookmarks for
        limit: Maximum number of bookmarks to return (default: 10)

    Returns:
        List of bookmark dictionaries with name, url, uuid, doctype, thumbnail_url, and type
    """

    # Create user-specific cache key
    cache_key = f"recent_bookmarks_{user.id}"

    cached_bookmarks = cache.get(cache_key)
    if cached_bookmarks is not None:
        return cached_bookmarks

    bookmark_list = Bookmark.objects.filter(
        user=user
    ).order_by(
        "-created"
    )[:limit]

    returned_bookmark_list = [
        {
            "name": bookmark.name,
            "url": reverse("bookmark:update", kwargs={"uuid": bookmark.uuid}),
            "uuid": str(bookmark.uuid),
            "doctype": "Bookmark",
            "thumbnail_url": bookmark.thumbnail_url,
            "type": "bookmark"
        }
        for bookmark in bookmark_list
    ]

    cache.set(cache_key, returned_bookmark_list)

    return returned_bookmark_list


# ---------------------------------------------------------------------------
# AWS service functions
# ---------------------------------------------------------------------------

def delete_bookmark_cover_images(uuid: str) -> None:
    """Delete all cover image variants for a bookmark from S3.

    Removes the full-size PNG, small PNG, and JPG thumbnail for the
    given bookmark.

    Args:
        uuid: The bookmark's UUID string.
    """
    bucket = settings.AWS_STORAGE_BUCKET_NAME
    for key in [
        f"bookmarks/{uuid}.png",
        f"bookmarks/{uuid}-small.png",
        f"bookmarks/{uuid}.jpg",
    ]:
        s3_delete_object(bucket, key)


def publish_bookmark_screenshot(url: str, uuid: str) -> None:
    """Publish an SNS message to trigger Chromda bookmark screenshot.

    Args:
        url: The bookmark URL to screenshot.
        uuid: The bookmark's UUID string, used as the S3 key.
    """
    message = {
        "url": url,
        "s3key": f"bookmarks/{uuid}.png",
        "puppeteer": {
            "screenshot": {
                "type": "jpeg",
                "quality": 50,
                "omitBackground": False,
            }
        },
    }
    sns_publish(settings.SNS_TOPIC_ARN, message)


def upload_youtube_thumbnail(uuid: str, image_bytes: bytes) -> None:
    """Upload a YouTube video thumbnail to S3.

    Stores the image as a public-read JPEG with cache-control and
    cover-image metadata.

    Args:
        uuid: The bookmark's UUID string.
        image_bytes: Raw JPEG image bytes to upload.
    """
    s3_put_object(
        settings.AWS_STORAGE_BUCKET_NAME,
        f"bookmarks/{uuid}.jpg",
        image_bytes,
        content_type="image/jpeg",
        acl="public-read",
        cache_control=f"max-age={S3_CACHE_MAX_AGE_SECONDS}",
        metadata={"cover-image": "Yes"},
    )


def invoke_snarf_favicon(url: str) -> None:
    """Invoke the SnarfFavicon Lambda to fetch and store a favicon.

    Args:
        url: The bookmark URL to extract the favicon from.
    """
    payload = {
        "url": url,
        "parse_domain": True,
    }
    lambda_invoke_async("SnarfFavicon", payload)
