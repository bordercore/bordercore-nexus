from botocore.errorfactory import ClientError
from elasticsearch.exceptions import ConnectionError

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import F
from django.http import JsonResponse
from django.shortcuts import render

from blob.models import Blob
from bookmark.models import Bookmark
from collection.models import Collection
from drill.models import Question
from fitness.services import get_overdue_exercises
from lib.calendar_events import Calendar
from lib.util import get_elasticsearch_connection
from music.models import Song
from quote.models import Quote
from todo.models import Todo


@login_required
def homepage(request):

    quote = Quote.objects.order_by("?").first()

    # Get any "pinned" bookmarks
    pinned_bookmarks = Bookmark.objects.filter(user=request.user, is_pinned=True)

    tasks = Todo.objects.filter(user=request.user, priority=Todo.get_priority_value("High")).prefetch_related("tags")[:5]

    # Get some recently played music
    music = Song.objects.filter(
        user=request.user
    ).select_related(
        "artist"
    ).order_by(
        F("last_time_played").desc(nulls_last=True)
    )[:5]

    # Choose a random image
    random_image_info = None
    try:
        random_image = get_random_image(request, "image/*")
        if random_image:
            try:
                random_image_info = {
                    **random_image,
                    "url": Blob.get_cover_url_static(
                        random_image["uuid"],
                        random_image["filename"],
                        "large",
                    ),
                }
            except ClientError as e:
                messages.add_message(request, messages.ERROR, f"Error getting random image info for uuid={random_image['uuid']}: {e}")
    except (ConnectionRefusedError, ConnectionError):
        messages.add_message(request, messages.ERROR, "Cannot connect to Elasticsearch")
    except ObjectDoesNotExist:
        messages.add_message(request, messages.ERROR, "Blob found in Elasticsearch but not the DB")

    # Get the most recent untagged bookmarks
    bookmarks = Bookmark.objects.bare_bookmarks(request.user, limit=50)

    # Get the list of "daily" bookmarks
    daily_bookmarks = Bookmark.objects.filter(user=request.user, daily__isnull=False)

    # Get the default collection
    default_collection = get_default_collection_blobs(request)

    overdue_exercises = get_overdue_exercises(request.user)

    return render(request, "homepage/index.html",
                  {"quote": quote,
                   "tasks": tasks,
                   "music": music,
                   "daily_bookmarks": daily_bookmarks,
                   "pinned_bookmarks": pinned_bookmarks,
                   "random_image_info": random_image_info,
                   "bookmarks": bookmarks,
                   "default_collection": default_collection,
                   "overdue_exercises": sorted(overdue_exercises, key=lambda x: x.delta_days, reverse=True),
                   "drill_total_progress": Question.objects.total_tag_progress(request.user),
                   "title": "Bordercore"})


@login_required
def get_calendar_events(request):

    calendar = Calendar(request.user.userprofile)
    if calendar.has_credentials():
        events = calendar.get_calendar_info()
    else:
        events = []

    return JsonResponse(events, safe=False)


def get_random_image(request, content_type=None):
    """
    Get a random image to display on the homepage. If a default
    collection is specified in user preferences, choose a random
    image from that. Otherwise choose a random image across all images
    from Elasticsearch.
    """

    if request.user.userprofile.homepage_image_collection:

        image = Blob.objects.filter(
            collectionobject__collection__id=request.user.userprofile.homepage_image_collection.id
        ).order_by("?").values().first()

        # The field name is 'filename' in Elasticsearch, so that's the common
        #  name that's used by consumers of this function
        image["filename"] = image["file"]
        return image

    es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT, timeout=5)

    search_object = {
        "query": {
            "function_score": {
                "random_score": {
                },
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
                                    "user_id": request.user.id
                                }
                            }
                        ]
                    }
                }
            }
        },
        "from_": 0,
        "size": 1,
        "_source": [
            "filename",
            "name",
            "uuid"
        ]
    }

    results = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)

    if results["hits"]["hits"]:
        return results["hits"]["hits"][0]["_source"]
    return None


def get_default_collection_blobs(request):

    try:
        collection = Collection.objects.get(pk=request.user.userprofile.homepage_default_collection.id)
        blob_info = collection.get_object_list(limit=3)
        return {
            "uuid": collection.uuid,
            "name": collection.name,
            "blob_list": blob_info["object_list"]
        }
    except AttributeError:
        return {}


@login_required
def gallery(request):
    return render(request, "homepage/gallery.html", {})


@login_required
def sql(request):
    context = {}
    if "sql_db_uuid" in request.GET:
        sql_db = Blob.objects.get(uuid=request.GET["sql_db_uuid"])
        context["sql_db_url"] = settings.MEDIA_URL + "blobs/" + sql_db.url

    return render(request, "homepage/sql.html", context)


def robots_txt(request):
    return render(request, "robots.txt", content_type="text/plain")


def handler404(request, _):

    response = render(request, "404.html", {})
    response.status_code = 404
    return response


def handler403(request, _):

    response = render(request, "403.html", {})
    response.status_code = 403
    return response


def handler500(request):

    response = render(request, "500.html", {})
    response.status_code = 500
    return response
