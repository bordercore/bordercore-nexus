"""Views for the homepage and related utility pages.

Renders the main dashboard with recent bookmarks, tasks, music, quotes,
fitness exercises, drill progress, and a random image. Also serves
calendar events, the gallery page, the SQL browser, error handlers,
and robots.txt.
"""

import json
from datetime import date
from uuid import UUID
from typing import cast

from botocore.errorfactory import ClientError
from elasticsearch.exceptions import ConnectionError

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db.models import F
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import render
from django.urls import reverse

from blob.models import Blob
from bookmark.models import Bookmark
from collection.models import Collection
from drill.models import Question
from fitness.models import Exercise
from fitness.services import get_overdue_exercises
from lib.calendar_events import Calendar
from lib.util import get_elasticsearch_connection
from music.models import Song
from habit.models import Habit
from quote.models import Quote
from reminder.models import Reminder
from todo.models import Todo


def json_for_html_attr(data: object) -> str:
    """Serialize data to JSON for use in HTML attributes."""
    return json.dumps(data)


@login_required
def homepage(request: HttpRequest) -> HttpResponse:
    """Render the main homepage dashboard.

    Aggregates pinned bookmarks, high-priority tasks, recent music, a random
    image, daily bookmarks, overdue exercises, drill progress, and a quote
    into the homepage template context.

    Args:
        request: The incoming HTTP request.

    Returns:
        Rendered homepage response.
    """
    user = cast(User, request.user)

    # Quote
    quote = Quote.objects.order_by("?").first()
    quote_json = json_for_html_attr({
        "quote": quote.quote,
        "source": quote.source,
    } if quote else None)

    # Bookmarks
    bookmarks = Bookmark.objects.bare_bookmarks(user, limit=50)
    daily_bookmarks = Bookmark.objects.filter(user=user, daily__isnull=False)

    bookmarks_json = json_for_html_attr([
        {"uuid": str(b.uuid), "name": b.name, "url": b.url}
        for b in bookmarks
    ])
    daily_bookmarks_json = json_for_html_attr([
        {
            "uuid": str(b.uuid),
            "name": b.name,
            "url": b.url,
            "daily": {"viewed": b.daily.get("viewed", "false")} if b.daily else None,
        }
        for b in daily_bookmarks
    ])

    # Tasks
    priority_value = Todo.get_priority_value("High")
    tasks = (
        Todo.objects.filter(user=user, priority=priority_value).prefetch_related("tags")[:5]
        if priority_value is not None
        else Todo.objects.none()
    )
    tasks_json = json_for_html_attr([
        {
            "uuid": str(task.uuid),
            "name": task.name,
            "priority_name": Todo.get_priority_name(task.priority),
            "tags": [tag.name for tag in task.tags.all()],
        }
        for task in tasks
    ])

    # Music
    music = Song.objects.filter(
        user=user
    ).select_related(
        "artist"
    ).order_by(
        F("last_time_played").desc(nulls_last=True)
    )[:5]
    music_json = json_for_html_attr([
        {
            "title": song.title,
            "artist": {"uuid": str(song.artist.uuid), "name": song.artist.name},
        }
        for song in music
    ])

    # Random image
    random_image_info = None
    try:
        random_image = get_random_image(user, "image/*")
        if random_image:
            try:
                random_image_info = {
                    **random_image,
                    "url": Blob.get_cover_url_static(
                        cast(UUID, random_image["uuid"]),
                        str(random_image["filename"]),
                        "large",
                    ),
                }
            except ClientError as e:
                messages.add_message(request, messages.ERROR, f"Error getting random image info for uuid={random_image['uuid']}: {e}")
    except (ConnectionRefusedError, ConnectionError):
        messages.add_message(request, messages.ERROR, "Cannot connect to Elasticsearch")
    except ObjectDoesNotExist:
        messages.add_message(request, messages.ERROR, "Blob found in Elasticsearch but not the DB")

    random_image_info_json = json_for_html_attr({
        "uuid": str(random_image_info["uuid"]),
        "name": random_image_info["name"],
        "url": random_image_info["url"],
    } if random_image_info else None)

    # Default collection
    default_collection = get_default_collection_blobs(user)
    default_collection_json = json_for_html_attr({
        "uuid": str(default_collection["uuid"]),
        "name": default_collection["name"],
        "blob_list": [
            {
                "uuid": str(blob["uuid"]),
                "url": blob.get("url", ""),
                "cover_url": blob.get("cover_url", ""),
            }
            for blob in default_collection.get("blob_list", [])
        ],
    } if default_collection else None)

    # Fitness
    overdue_exercises = cast(list[Exercise], get_overdue_exercises(user, prefetch_muscles=False))
    overdue_exercises_sorted = sorted(
        overdue_exercises, key=lambda x: getattr(x, "delta_days", 0), reverse=True
    )
    overdue_exercises_json = json_for_html_attr([
        {
            "uuid": str(exercise.uuid),
            "name": exercise.name,
            "delta_days": getattr(exercise, "delta_days", 0),
        }
        for exercise in overdue_exercises_sorted
    ])

    # Reminders — next 5 upcoming, active only. Compute next_trigger_at live
    # so the list stays accurate even when the trigger_reminders command is
    # behind (the stored value can be null or in the past).
    active_reminders = Reminder.objects.filter(user=user, is_active=True)
    reminders_with_next = []
    for reminder in active_reminders:
        next_at = reminder.calculate_next_trigger_at()
        if next_at is not None:
            reminders_with_next.append((next_at, reminder))
    reminders_with_next.sort(key=lambda pair: pair[0])

    reminders_json = json_for_html_attr([
        {
            "uuid": str(r.uuid),
            "name": r.name,
            "next_trigger_at": next_at.isoformat(),
            "schedule": r.get_schedule_description(),
        }
        for next_at, r in reminders_with_next[:5]
    ])

    # Habits — active habits with the number of days since the habit started.
    today = date.today()
    active_habits = Habit.objects.active(user).order_by("?")[:6]
    habits_json = json_for_html_attr([
        {
            "uuid": str(habit.uuid),
            "name": habit.name,
            "streak": max(0, (today - habit.start_date).days),
        }
        for habit in active_habits
    ])

    # Drill progress
    drill_total_progress = Question.objects.total_tag_progress(user)
    drill_progress_json = json_for_html_attr({
        "count": drill_total_progress["count"],
        "percentage": drill_total_progress["percentage"],
    })

    return render(request, "homepage/index.html", {
        "tasks_json": tasks_json,
        "drill_progress_json": drill_progress_json,
        "overdue_exercises_json": overdue_exercises_json,
        "daily_bookmarks_json": daily_bookmarks_json,
        "bookmarks_json": bookmarks_json,
        "music_json": music_json,
        "quote_json": quote_json,
        "random_image_info_json": random_image_info_json,
        "default_collection_json": default_collection_json,
        "reminders_json": reminders_json,
        "habits_json": habits_json,
        "title": "Bordercore",
    })


@login_required
def get_calendar_events(request: HttpRequest) -> JsonResponse:
    """Return the user's Google Calendar events as JSON.

    Args:
        request: The incoming HTTP request.

    Returns:
        JSON response containing a list of calendar events.
    """
    user = cast(User, request.user)
    calendar = Calendar(user.userprofile)
    if calendar.has_credentials():
        events = calendar.get_calendar_info()
    else:
        events = []

    return JsonResponse(events, safe=False)


def get_random_image(user: User, content_type: str | None = None) -> dict[str, object] | None:
    """Get a random image to display on the homepage.

    If a default collection is specified in user preferences, choose a random
    image from that. Otherwise choose a random image across all images
    from Elasticsearch.

    Args:
        user: The user to get the random image for.
        content_type: Optional wildcard content type filter (e.g. "image/*").

    Returns:
        Dict with image info, or None if no image found.
    """
    if user.userprofile.homepage_image_collection:
        qs = Blob.objects.filter(
            collectionobject__collection__id=user.userprofile.homepage_image_collection.id
        )
        if content_type == "image/*":
            qs = qs.filter(file__regex=r'(?i)\.(bmp|gif|jpg|jpeg|png|tiff)$')

        image = qs.order_by("?").values().first()

        if image:
            result: dict[str, object] = dict(image)
            result["filename"] = image["file"]
            return result

    es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT, timeout=5)

    search_object = {
        "query": {
            "function_score": {
                "random_score": {},
                "query": {
                    "bool": {
                        "must": [
                            {
                                "wildcard": {
                                    "content_type": {
                                        "value": content_type,
                                    }
                                }
                            },
                            {
                                "term": {
                                    "user_id": user.id
                                }
                            }
                        ]
                    }
                }
            }
        },
        "size": 1,
        "_source": [
            "filename",
            "name",
            "uuid"
        ]
    }

    results = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)

    if results["hits"]["hits"]:
        return dict(results["hits"]["hits"][0]["_source"])
    return None


def get_default_collection_blobs(user: User) -> dict:
    """Fetch blobs from the user's default homepage collection.

    Args:
        user: The user whose default collection to fetch.

    Returns:
        Dict with collection uuid, name, and blob_list, or empty dict.
    """
    collection = user.userprofile.homepage_default_collection
    if not collection:
        return {}

    try:
        blob_info = collection.get_object_list(limit=3)
        return {
            "uuid": collection.uuid,
            "name": collection.name,
            "blob_list": blob_info["object_list"]
        }
    except Collection.DoesNotExist:
        return {}


@login_required
def gallery(request: HttpRequest) -> HttpResponse:
    """Render the image gallery page.

    Args:
        request: The incoming HTTP request.

    Returns:
        Rendered gallery page response.
    """
    return render(request, "homepage/gallery.html", {})


@login_required
def sql(request: HttpRequest) -> HttpResponse:
    """Render the SQL browser page for a given blob database.

    Args:
        request: The incoming HTTP request. May include a ``sql_db_uuid``
            query parameter to select the database blob.

    Returns:
        Rendered SQL browser page response.
    """
    user = cast(User, request.user)
    context = {}
    if "sql_db_uuid" in request.GET:
        sql_db_uuid = request.GET["sql_db_uuid"]
        try:
            sql_db = Blob.objects.get(uuid=sql_db_uuid, user=user)
            # Use the proxy URL instead of direct S3 URL to avoid CORS issues
            context["sql_db_url"] = reverse("blob:file", kwargs={"uuid": sql_db.uuid})
        except (Blob.DoesNotExist, ValidationError):
            messages.add_message(request, messages.ERROR, "SQL database not found")

    return render(request, "homepage/sql.html", context)


def robots_txt(request: HttpRequest) -> HttpResponse:
    """Serve the robots.txt file as plain text.

    Args:
        request: The incoming HTTP request.

    Returns:
        Plain-text robots.txt response.
    """
    return render(request, "robots.txt", content_type="text/plain")


def handler404(request: HttpRequest, exception: Exception | None = None) -> HttpResponse:
    """Custom 404 error handler.

    Args:
        request: The incoming HTTP request.
        exception: The exception that triggered the 404, if any.

    Returns:
        Rendered 404 page with status code 404.
    """
    response = render(request, "404.html", {})
    response.status_code = 404
    return response


def handler403(request: HttpRequest, exception: Exception | None = None) -> HttpResponse:
    """Custom 403 error handler.

    Args:
        request: The incoming HTTP request.
        exception: The exception that triggered the 403, if any.

    Returns:
        Rendered 403 page with status code 403.
    """
    response = render(request, "403.html", {})
    response.status_code = 403
    return response


def handler500(request: HttpRequest) -> HttpResponse:
    """Custom 500 error handler.

    Args:
        request: The incoming HTTP request.

    Returns:
        Rendered 500 page with status code 500.
    """
    response = render(request, "500.html", {})
    response.status_code = 500
    return response
