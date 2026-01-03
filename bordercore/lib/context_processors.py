"""Django context processors for providing template context data.

This module contains context processor functions that add data to the template
context for all views. These processors provide navigation badge counts, recent
objects, search history, overdue tasks, and Django messages formatted for
frontend consumption.
"""

import json
import logging
from typing import Any, cast

from django import urls
from django.conf import settings
from django.contrib import messages
from django.http import HttpRequest
from django.utils import timezone

from blob.services import get_recent_blobs as get_recent_blobs_service
from blob.services import get_recent_media, get_recently_viewed
from bookmark.models import Bookmark
from bookmark.services import get_recent_bookmarks
from fitness.services import get_overdue_exercises
from metrics.models import Metric
from search.models import RecentSearch
from todo.models import Todo

logger = logging.getLogger(__name__)

HIGH_PRIORITY = Todo.get_priority_value("High")


def get_counts(request: HttpRequest) -> dict[str, int]:
    """Get counts to display as badges on the left navigation bar.

    Retrieves counts for high-priority todos, overdue exercises, untagged
    bookmarks, and failed tests. These counts are used to display badge
    indicators in the navigation.

    Args:
        request: The HTTP request object containing user information.

    Returns:
        Dictionary containing:
            - bookmark_untagged_count: Number of bookmarks without tags
            - exercise_count: Number of overdue exercises
            - todo_count: Number of high-priority todo items
            - failed_test_count: Number of failed test metrics
        Returns empty dict if user is not authenticated.
    """
    if not request.user.is_authenticated:
        return {}

    # Get high priority todo items
    if HIGH_PRIORITY is None:
        todo_count = 0
    else:
        todo_count = Todo.objects.filter(user=request.user, priority=HIGH_PRIORITY).count()

    # Get overdue_exercises
    # When count_only=True, get_overdue_exercises always returns int
    exercise_count = cast(int, get_overdue_exercises(request.user, True))

    bookmark_untagged_count = Bookmark.objects.filter(user=request.user, tags__isnull=True).count()

    # Get failed test count
    failed_test_count = Metric.objects.get_failed_test_count(request.user)

    return {
        "bookmark_untagged_count": bookmark_untagged_count,
        "exercise_count": exercise_count,
        "todo_count": todo_count,
        "failed_test_count": failed_test_count
    }


def get_recent_objects(request: HttpRequest) -> dict[str, Any]:
    """Get a list of recently created objects for display in the UI.

    Retrieves recent blobs, bookmarks, media files, and recently viewed blobs
    for the authenticated user. Blob content is only included when viewing
    the blob list page to reduce payload size.

    Args:
        request: The HTTP request object containing user and path information.

    Returns:
        Dictionary containing:
            - recent_blobs: Dict with "blobList" and "docTypes" keys
            - recent_bookmarks: Dict with "bookmarkList" key
            - recent_media: Dict with "mediaList" key
            - recently_viewed: Dict with "blobList" key
            - elasticsearch_error: Error message string if Elasticsearch fails
        Returns empty dict if user is not authenticated.
    """
    if not request.user.is_authenticated:
        return {}

    # Only include the blob content on the blob list page. This
    #  is only included when needed because of its size.
    skip_content = urls.reverse("blob:list") != request.get_full_path()

    recent_blobs: list[dict[str, Any]] = []
    doctypes: dict[str, int] = {}
    recent_media = []
    recent_bookmarks = []
    recently_viewed_blobs = []
    elasticsearch_error = ""

    try:
        recent_blobs, doctypes = get_recent_blobs_service(request.user, skip_content=skip_content)
        recent_media = get_recent_media(request.user)
        recent_bookmarks = get_recent_bookmarks(request.user)
        recently_viewed_blobs = get_recently_viewed(request.user)
    except Exception as e:
        logger.exception(f"Error fetching recent objects from Elasticsearch: {e}")
        elasticsearch_error = str(e)

    return {
        "recent_blobs": {
            "blobList": recent_blobs,
            "docTypes": doctypes,
        },
        "recent_bookmarks": {
            "bookmarkList": recent_bookmarks
        },
        "recent_media": {
            "mediaList": recent_media
        },
        "recently_viewed": {
            "blobList": recently_viewed_blobs
        },
        "elasticsearch_error": elasticsearch_error
    }


def get_recent_searches(request: HttpRequest) -> dict[str, list[dict[str, Any]]]:
    """Get the user's recent search queries.

    Retrieves the most recent 10 search queries performed by the authenticated
    user for display in search-related UI components.

    Args:
        request: The HTTP request object containing user information.

    Returns:
        Dictionary containing:
            - recent_searches: List of dicts with "id" and "search_text" keys
        Returns empty dict if user is not authenticated.
    """
    if not request.user.is_authenticated:
        return {}

    recent_searches = RecentSearch.objects.filter(user=request.user)[:10]

    return {
        "recent_searches": [
            {
                "id": x.id,
                "search_text": x.search_text
            }
            for x in
            recent_searches
        ]
    }


def get_overdue_tasks(request: HttpRequest) -> dict[str, list[dict[str, Any]]]:
    """Return a list of todo tasks that are overdue.

    Retrieves all todo items with due dates in the past, formats them with
    their UUIDs, names, and tags, then clears the due dates for all retrieved
    tasks to prevent them from appearing as overdue again.

    Args:
        request: The HTTP request object containing user information.

    Returns:
        Dictionary containing:
            - overdue_tasks: List of dicts with "uuid", "name", and "tags" keys
        Returns empty dict if user is not authenticated.
    """
    if not request.user.is_authenticated:
        return {}

    tasks = [
        {
            "uuid": x.uuid,
            "name": x.name,
            "tags": [x.name for x in x.tags.all()]
        }
        for x in
        Todo.objects.filter(user=request.user, due_date__lt=timezone.now())
    ]

    # Once retrieved, remove the due dates for all overdue tasks
    Todo.objects.filter(user=request.user, uuid__in=[x["uuid"] for x in tasks]).update(due_date=None)

    return {
        "overdue_tasks": tasks
    }


def set_constants(request: HttpRequest) -> dict[str, str]:
    """Set application constants for use in templates.

    Provides media URL constants from Django settings for use in templates.
    These constants define paths for music media and image assets.

    Args:
        request: The HTTP request object containing user information.

    Returns:
        Dictionary containing:
            - MEDIA_URL_MUSIC: URL path for music media files
            - IMAGES_URL: URL path for image assets
        Returns empty dict if user is not authenticated.
    """
    if not request.user.is_authenticated:
        return {}

    return {
        "MEDIA_URL_MUSIC": settings.MEDIA_URL_MUSIC,
        "IMAGES_URL": settings.IMAGES_URL,
    }


def convert_django_to_bootstrap(tags: str) -> str | None:
    """Convert Django message tag to Bootstrap alert variant.

    Maps Django's message level tags to corresponding Bootstrap alert
    class names. Used for styling Django messages in Bootstrap-based UI.

    Args:
        tags: Space-separated string of Django message tags (e.g., "error",
            "warning", "info", "success", "debug").

    Returns:
        Bootstrap variant name ("info", "success", "warning", or "danger"),
        or None if no matching tag is found.
    """
    django_to_bootstrap = {
        "debug": "info",
        "info": "info",
        "success": "success",
        "warning": "warning",
        "error": "danger"
    }

    for tag in tags.split(" "):
        if tag in django_to_bootstrap:
            return django_to_bootstrap[tag]
    return None


def has_no_autohide_tag(tags: str) -> bool:
    """Check if the "noAutoHide" tag is present in the tag string.

    Determines whether a Django message should remain visible without
    automatically hiding, based on the presence of the "noAutoHide" tag.

    Args:
        tags: Space-separated string of message tags.

    Returns:
        True if "noAutoHide" is present in the tags, False otherwise.
    """
    return "noAutoHide" in tags.split(" ")


def json_messages(request: HttpRequest) -> dict[str, str]:
    """Convert Django messages to JSON format for frontend consumption.

    Retrieves all Django messages from the request, converts them to a JSON
    string with Bootstrap-compatible styling information, and includes
    auto-hide behavior flags.

    Args:
        request: The HTTP request object containing Django messages.

    Returns:
        Dictionary containing:
            - json_messages: JSON string containing list of message objects
              with "body", "variant", and "autoHide" keys.
    """
    return {
        "json_messages": json.dumps(
            [
                {
                    "body": str(x),
                    "variant": convert_django_to_bootstrap(x.tags),
                    "autoHide": not has_no_autohide_tag(x.tags)
                }
                for x in
                messages.get_messages(request)
            ]
        )
    }
