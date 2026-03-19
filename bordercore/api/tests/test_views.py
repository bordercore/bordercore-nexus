from datetime import timedelta

import pytest
from faker import Factory as FakerFactory
from feed.tests.factories import FeedFactory

from django import urls
from django.conf import settings
from django.utils import timezone

pytestmark = [pytest.mark.django_db]

from accounts.models import UserTag
from accounts.tests.factories import UserFactory
from blob.tests.factories import BlobFactory
from bookmark.models import Bookmark
from bookmark.tests.factories import BookmarkFactory
from collection.tests.factories import CollectionFactory
from drill.tests.factories import QuestionFactory
from fitness.models import Data, Exercise, ExerciseUser, Workout
from music.tests.factories import PlaylistFactory, SongFactory
from reminder.models import Reminder
from reminder.tests.factories import ReminderFactory
from tag.models import TagBookmark
from tag.tests.factories import TagFactory
from todo.tests.factories import TodoFactory

faker = FakerFactory.create()


def test_album_viewset(authenticated_client, song):

    _, client = authenticated_client()

    url = urls.reverse("album-list")
    resp = client.get(url)
    assert resp.status_code == 200

    url = urls.reverse("album-detail", kwargs={"uuid": song[0].album.uuid})
    resp = client.get(url)
    assert resp.status_code == 200


def test_blob_viewset(authenticated_client, blob_image_factory):

    # Quiet spurious output
    settings.NPLUSONE_WHITELIST = [
        {
            "label": "unused_eager_load",
            "model": "blob.Blob"
        },
        {
            "label": "n_plus_one",
            "model": "blob.Blob"
        }
    ]

    _, client = authenticated_client()

    url = urls.reverse("blob-list")
    resp = client.get(url)
    assert resp.status_code == 200

    url = urls.reverse("blob-detail", kwargs={"uuid": blob_image_factory[0].uuid})
    resp = client.get(url)
    assert resp.status_code == 200

    # Test that requesting a different user's blob returns a 404
    different_user = UserFactory(username=faker.user_name())
    blob = BlobFactory(user=different_user)
    url = urls.reverse("blob-detail", kwargs={"uuid": blob.uuid})
    resp = client.get(url)
    assert resp.status_code == 404


def test_sha1sum_viewset(authenticated_client, blob_image_factory):

    _, client = authenticated_client()

    url = urls.reverse("sha1sum-list")
    resp = client.get(url)
    assert resp.status_code == 200

    url = urls.reverse("sha1sum-detail", kwargs={"sha1sum": blob_image_factory[0].sha1sum})
    resp = client.get(url)
    assert resp.status_code == 200


def test_bookmark_viewset(authenticated_client, bookmark):

    _, client = authenticated_client()

    url = urls.reverse("bookmark-list")
    resp = client.get(url)
    assert resp.status_code == 200

    url = urls.reverse("bookmark-detail", kwargs={"uuid": bookmark[0].uuid})
    resp = client.get(url)
    assert resp.status_code == 200

    # Test that requesting a different user's bookmark returns a 404
    different_user = UserFactory(username=faker.user_name())
    bookmark = BookmarkFactory(user=different_user)
    url = urls.reverse("bookmark-detail", kwargs={"uuid": bookmark.uuid})
    resp = client.get(url)
    assert resp.status_code == 404

    url = urls.reverse("bookmark-list")
    resp = client.post(
        url,
        {
            "url": faker.url(),
            "name": faker.text(max_nb_chars=32)
        }
    )
    assert resp.status_code == 201


def test_collection_viewset(authenticated_client, collection):

    _, client = authenticated_client()

    url = urls.reverse("collection-list")
    resp = client.get(url)
    assert resp.status_code == 200

    url = urls.reverse("collection-detail", kwargs={"uuid": collection[0].uuid})
    resp = client.get(url)
    assert resp.status_code == 200

    # Test that requesting a different user's collection returns a 404
    different_user = UserFactory(username=faker.user_name())
    collection = CollectionFactory(user=different_user)
    url = urls.reverse("collection-detail", kwargs={"uuid": collection.uuid})
    resp = client.get(url)
    assert resp.status_code == 404

    url = urls.reverse("collection-list")
    resp = client.post(
        url,
        {
            "name": faker.text(max_nb_chars=32),
        }
    )
    assert resp.status_code == 201


def test_feed_viewset(authenticated_client, feed):

    _, client = authenticated_client()

    url = urls.reverse("feed-list")
    resp = client.get(url)
    assert resp.status_code == 200

    url = urls.reverse("feed-detail", kwargs={"uuid": feed[0].uuid})
    resp = client.get(url)
    assert resp.status_code == 200

    # Test that requesting a different user's feed returns a 404
    different_user = UserFactory(username=faker.user_name())
    feed = FeedFactory(user=different_user)
    url = urls.reverse("feed-detail", kwargs={"uuid": feed.uuid})
    resp = client.get(url)
    assert resp.status_code == 404

    url = urls.reverse("feed-list")
    resp = client.post(
        url,
        {
            "homepage": faker.url(),
            "name": faker.text(max_nb_chars=32),
            "url": faker.url()
        }
    )
    assert resp.status_code == 201


def test_feeditem_viewset(authenticated_client, feed):

    _, client = authenticated_client()

    url = urls.reverse("feeditem-list")
    resp = client.get(url)
    assert resp.status_code == 200

    url = urls.reverse("feeditem-detail", kwargs={"pk": feed[0].feeditem_set.first().id})
    resp = client.get(url)
    assert resp.status_code == 200


def test_question_viewset(authenticated_client, question):

    _, client = authenticated_client()

    url = urls.reverse("question-list")
    resp = client.get(url)
    assert resp.status_code == 200

    url = urls.reverse("question-detail", kwargs={"uuid": question[0].uuid})
    resp = client.get(url)
    assert resp.status_code == 200

    # Test that requesting a different user's question returns a 404
    different_user = UserFactory(username=faker.user_name())
    question = QuestionFactory(user=different_user)
    url = urls.reverse("question-detail", kwargs={"uuid": question.uuid})
    resp = client.get(url)
    assert resp.status_code == 404


def test_playlist_viewset(authenticated_client, playlist):

    _, client = authenticated_client()

    url = urls.reverse("playlist-list")
    resp = client.get(url)
    assert resp.status_code == 200

    url = urls.reverse("playlist-detail", kwargs={"uuid": playlist[0].uuid})
    resp = client.get(url)
    assert resp.status_code == 200

    # Test that requesting a different user's playlist returns a 404
    different_user = UserFactory(username=faker.user_name())
    playlist = PlaylistFactory(user=different_user)
    url = urls.reverse("playlist-detail", kwargs={"uuid": playlist.uuid})
    resp = client.get(url)
    assert resp.status_code == 404


def test_playlistitem_viewset(authenticated_client, playlist):

    _, client = authenticated_client()

    url = urls.reverse("playlistitem-list")
    resp = client.get(url)
    assert resp.status_code == 200

    url = urls.reverse("playlistitem-detail", kwargs={"uuid": playlist[0].playlistitem_set.first().uuid})
    resp = client.get(url)
    assert resp.status_code == 200


def test_song_viewset(authenticated_client, song):

    _, client = authenticated_client()

    different_user = UserFactory(username=faker.user_name())
    song_different_user = SongFactory(user=different_user)

    url = urls.reverse("song-list")
    resp = client.get(url)
    assert resp.status_code == 200
    result = resp.json()["results"]
    assert len(result) == 3
    assert str(song[0].uuid) in [x["uuid"] for x in result]
    assert str(song[1].uuid) in [x["uuid"] for x in result]
    assert str(song[2].uuid) in [x["uuid"] for x in result]

    # A different user's song should NOT be in the list
    assert str(song_different_user.uuid) not in [x["uuid"] for x in result]

    url = urls.reverse("song-detail", kwargs={"uuid": song[0].uuid})
    resp = client.get(url)
    assert resp.status_code == 200

    # Test that requesting a different user's song returns a 404
    url = urls.reverse("song-detail", kwargs={"uuid": song_different_user.uuid})
    resp = client.get(url)
    assert resp.status_code == 404


def test_songsource_viewset(authenticated_client, song_source):

    _, client = authenticated_client()

    url = urls.reverse("songsource-list")
    resp = client.get(url)
    assert resp.status_code == 200

    url = urls.reverse("songsource-detail", kwargs={"pk": song_source.id})
    resp = client.get(url)
    assert resp.status_code == 200


def test_tag_viewset(authenticated_client, tag):

    _, client = authenticated_client()

    url = urls.reverse("tag-list")
    resp = client.get(url)
    assert resp.status_code == 200

    url = urls.reverse("tag-detail", kwargs={"pk": tag[0].id})
    resp = client.get(url)
    assert resp.status_code == 200

    # Test that requesting a different user's tag returns a 404
    different_user = UserFactory(username=faker.user_name())
    tag_1 = TagFactory(user=different_user)
    url = urls.reverse("tag-detail", kwargs={"pk": tag_1.id})
    resp = client.get(url)
    assert resp.status_code == 404

    url = urls.reverse("tagname-detail", kwargs={"name": tag[0].name})
    resp = client.get(url)
    assert resp.status_code == 200


def test_tagalias_viewset(authenticated_client, tag):

    _, client = authenticated_client()

    url = urls.reverse("tagalias-list")
    resp = client.get(url)
    assert resp.status_code == 200


def test_todo_viewset(authenticated_client, todo):

    _, client = authenticated_client()

    url = urls.reverse("todo-list")
    resp = client.get(url)
    assert resp.status_code == 200

    url = urls.reverse("todo-detail", kwargs={"uuid": todo.uuid})
    resp = client.get(url)
    assert resp.status_code == 200

    # Test that requesting a different user's todo item returns a 404
    different_user = UserFactory(username=faker.user_name())
    todo = TodoFactory(user=different_user)
    url = urls.reverse("todo-detail", kwargs={"uuid": todo.uuid})
    resp = client.get(url)
    assert resp.status_code == 404


def test_todo_viewset_filters_by_priority(authenticated_client):
    user, client = authenticated_client()

    high = TodoFactory(user=user, priority=1)
    medium = TodoFactory(user=user, priority=2)
    low = TodoFactory(user=user, priority=3)

    url = urls.reverse("todo-list")
    resp = client.get(url, {"priority": 1})
    assert resp.status_code == 200

    result = resp.json()
    returned_uuids = {item["uuid"] for item in result}
    assert str(high.uuid) in returned_uuids
    assert str(medium.uuid) not in returned_uuids
    assert str(low.uuid) not in returned_uuids


def test_todo_viewset_filters_by_tag(authenticated_client):
    user, client = authenticated_client()

    work_tag = TagFactory(user=user, name="work")
    home_tag = TagFactory(user=user, name="home")
    work_todo = TodoFactory(user=user, priority=1)
    home_todo = TodoFactory(user=user, priority=2)

    work_todo.tags.add(work_tag)
    home_todo.tags.add(home_tag)

    url = urls.reverse("todo-list")
    resp = client.get(url, {"tag": "work"})
    assert resp.status_code == 200

    result = resp.json()
    returned_uuids = {item["uuid"] for item in result}
    assert str(work_todo.uuid) in returned_uuids
    assert str(home_todo.uuid) not in returned_uuids


def test_reminder_viewset(authenticated_client):
    """Reminder viewset exposes only the authenticated user's reminders."""
    user, client = authenticated_client()

    reminder = ReminderFactory(user=user)
    url = urls.reverse("reminder-list")
    resp = client.get(url)
    assert resp.status_code == 200

    result = resp.json()
    assert isinstance(result, list)
    assert str(reminder.uuid) in [x["uuid"] for x in result]

    url = urls.reverse("reminder-detail", kwargs={"uuid": reminder.uuid})
    resp = client.get(url)
    assert resp.status_code == 200

    different_user = UserFactory(username=faker.user_name())
    other_reminder = ReminderFactory(user=different_user)
    url = urls.reverse("reminder-detail", kwargs={"uuid": other_reminder.uuid})
    resp = client.get(url)
    assert resp.status_code == 404


def test_reminder_viewset_uses_web_list_ordering(authenticated_client):
    """Reminder list ordering matches the web reminders page ordering."""
    user, client = authenticated_client()

    now = timezone.now()
    early_trigger = now + timedelta(hours=1)
    shared_trigger = now + timedelta(hours=4)

    oldest = ReminderFactory(user=user, next_trigger_at=shared_trigger)
    newest = ReminderFactory(user=user, next_trigger_at=shared_trigger)
    earliest = ReminderFactory(user=user, next_trigger_at=early_trigger)

    Reminder.objects.filter(pk=oldest.pk).update(created=now - timedelta(days=2))
    Reminder.objects.filter(pk=newest.pk).update(created=now - timedelta(days=1))

    url = urls.reverse("reminder-list")
    resp = client.get(url)
    assert resp.status_code == 200

    returned_uuids = [item["uuid"] for item in resp.json()]
    earliest_index = returned_uuids.index(str(earliest.uuid))
    newest_index = returned_uuids.index(str(newest.uuid))
    oldest_index = returned_uuids.index(str(oldest.uuid))

    assert earliest_index < newest_index
    assert newest_index < oldest_index


# --- Feed item user isolation (#20) ---

def test_feeditem_viewset_user_isolation(authenticated_client, feed):
    """Feed items from another user's feed are not visible."""
    _, client = authenticated_client()

    different_user = UserFactory(username=faker.user_name())
    other_feed = FeedFactory(user=different_user)

    url = urls.reverse("feeditem-detail", kwargs={"pk": other_feed.feeditem_set.first().id})
    resp = client.get(url)
    assert resp.status_code == 404


# --- Bookmark custom actions (#16) ---

def test_bookmark_untagged_action(authenticated_client, monkeypatch_bookmark):
    """GET /api/bookmarks/untagged/ returns only bookmarks without tags."""
    user, client = authenticated_client()

    tagged = BookmarkFactory(user=user)
    untagged = BookmarkFactory(user=user)

    tag = TagFactory(user=user, name="test-tag")
    tagged.tags.add(tag)

    url = urls.reverse("bookmark-untagged")
    resp = client.get(url)
    assert resp.status_code == 200

    returned_uuids = {item["uuid"] for item in resp.json().get("results", resp.json())}
    assert str(untagged.uuid) in returned_uuids
    assert str(tagged.uuid) not in returned_uuids


def test_bookmark_by_tag_action(authenticated_client, monkeypatch_bookmark):
    """GET /api/bookmarks/by-tag/<name>/ returns bookmarks for that tag."""
    user, client = authenticated_client()

    tag = TagFactory(user=user, name="by-tag-test")
    bm = BookmarkFactory(user=user)
    TagBookmark.objects.create(tag=tag, bookmark=bm)

    other_bm = BookmarkFactory(user=user)

    url = urls.reverse("bookmark-by-tag", kwargs={"tag_name": "by-tag-test"})
    resp = client.get(url)
    assert resp.status_code == 200

    data = resp.json()
    returned_uuids = {item["uuid"] for item in data}
    assert str(bm.uuid) in returned_uuids
    assert str(other_bm.uuid) not in returned_uuids


# --- Pinned tags (#17) ---

def test_pinned_tags_action(authenticated_client, monkeypatch_bookmark):
    """GET /api/tags/pinned/ returns the user's pinned tags with counts."""
    user, client = authenticated_client()

    tag = TagFactory(user=user, name="pinned-test")
    UserTag.objects.create(userprofile=user.userprofile, tag=tag)

    bm = BookmarkFactory(user=user)
    TagBookmark.objects.create(tag=tag, bookmark=bm)

    url = urls.reverse("tag-pinned")
    resp = client.get(url)
    assert resp.status_code == 200

    data = resp.json()
    assert any(t["name"] == "pinned-test" for t in data)
    pinned = next(t for t in data if t["name"] == "pinned-test")
    assert pinned["bookmark_count"] >= 1


# --- Write operations (#18) ---

def test_bookmark_delete(authenticated_client, monkeypatch):
    """DELETE on a bookmark removes it."""
    user, client = authenticated_client()

    monkeypatch.setattr(Bookmark, "generate_cover_image", lambda *a, **kw: None)
    monkeypatch.setattr(Bookmark, "snarf_favicon", lambda *a, **kw: None)
    bm = BookmarkFactory(user=user)
    url = urls.reverse("bookmark-detail", kwargs={"uuid": bm.uuid})
    resp = client.delete(url)
    assert resp.status_code == 204


def test_bookmark_patch(authenticated_client, monkeypatch_bookmark):
    """PATCH on a bookmark updates it."""
    user, client = authenticated_client()

    bm = BookmarkFactory(user=user)
    url = urls.reverse("bookmark-detail", kwargs={"uuid": bm.uuid})
    resp = client.patch(url, {"name": "updated-name"}, content_type="application/json")
    assert resp.status_code == 200
    assert resp.json()["name"] == "updated-name"


def test_todo_create(authenticated_client):
    """POST to todo-list creates a todo."""
    _, client = authenticated_client()

    url = urls.reverse("todo-list")
    resp = client.post(url, {"name": "new task", "priority": 2})
    assert resp.status_code == 201


def test_todo_delete(authenticated_client):
    """DELETE on a todo removes it."""
    user, client = authenticated_client()

    todo = TodoFactory(user=user)
    url = urls.reverse("todo-detail", kwargs={"uuid": todo.uuid})
    resp = client.delete(url)
    assert resp.status_code == 204


def test_todo_patch(authenticated_client):
    """PATCH on a todo updates it."""
    user, client = authenticated_client()

    todo = TodoFactory(user=user)
    url = urls.reverse("todo-detail", kwargs={"uuid": todo.uuid})
    resp = client.patch(url, {"name": "updated"}, content_type="application/json")
    assert resp.status_code == 200


def test_collection_delete(authenticated_client, collection):
    """DELETE on a collection removes it."""
    _, client = authenticated_client()

    url = urls.reverse("collection-detail", kwargs={"uuid": collection[0].uuid})
    resp = client.delete(url)
    assert resp.status_code == 204


def test_feed_delete(authenticated_client, feed):
    """DELETE on a feed removes it."""
    _, client = authenticated_client()

    url = urls.reverse("feed-detail", kwargs={"uuid": feed[0].uuid})
    resp = client.delete(url)
    assert resp.status_code == 204


# --- Blob field selection (#19) ---

def test_blob_field_selection(authenticated_client, blob_image_factory):
    """GET /api/blobs/?fields=name,uuid returns only those fields."""
    settings.NPLUSONE_WHITELIST = [
        {"label": "unused_eager_load", "model": "blob.Blob"},
        {"label": "n_plus_one", "model": "blob.Blob"},
    ]

    _, client = authenticated_client()

    url = urls.reverse("blob-list")
    resp = client.get(url, {"fields": "name,uuid"})
    assert resp.status_code == 200

    results = resp.json().get("results", resp.json())
    assert len(results) > 0
    for item in results:
        assert "name" in item
        assert "uuid" in item
        assert "content" not in item
        assert "sha1sum" not in item


# --- Fitness viewset (#15) ---

def test_fitness_summary(authenticated_client):
    """GET /api/fitness/summary/ returns active and inactive lists."""
    user, client = authenticated_client()

    exercise = Exercise.objects.create(name=f"test-summary-{faker.uuid4()}")
    ExerciseUser.objects.create(
        user=user,
        exercise=exercise,
        started=timezone.now(),
        schedule=[True, False, True, False, False, False, False],
    )

    url = urls.reverse("fitness-summary")
    resp = client.get(url)
    assert resp.status_code == 200
    data = resp.json()
    assert "active" in data
    assert "inactive" in data
    assert any(item["uuid"] == str(exercise.uuid) for item in data["active"])

    item = next(item for item in data["active"] if item["uuid"] == str(exercise.uuid))
    assert item["schedule"] == [True, False, True, False, False, False, False]


def test_fitness_exercise_detail(authenticated_client):
    """GET /api/fitness/exercise/<uuid>/ returns exercise detail."""
    user, client = authenticated_client()

    exercise = Exercise.objects.create(name=f"test-exercise-{faker.uuid4()}")

    url = urls.reverse("fitness-exercise", kwargs={"exercise_uuid": exercise.uuid})
    resp = client.get(url)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == exercise.name
    assert data["uuid"] == str(exercise.uuid)


def test_fitness_exercise_not_found(authenticated_client):
    """GET /api/fitness/exercise/<bad-uuid>/ returns 404."""
    _, client = authenticated_client()

    url = urls.reverse("fitness-exercise", kwargs={"exercise_uuid": faker.uuid4()})
    resp = client.get(url)
    assert resp.status_code == 404


def test_fitness_add_workout(authenticated_client):
    """POST /api/fitness/exercise/<uuid>/workouts/ creates a workout."""
    user, client = authenticated_client()

    exercise = Exercise.objects.create(name=f"test-workout-{faker.uuid4()}")

    url = urls.reverse("fitness-add-workout", kwargs={"exercise_uuid": exercise.uuid})
    resp = client.post(
        url,
        {"sets": [{"weight": 100, "reps": 10, "duration": 0}]},
        content_type="application/json",
    )
    assert resp.status_code == 201
    assert Workout.objects.filter(user=user, exercise=exercise).exists()
    assert Data.objects.filter(workout__exercise=exercise, weight=100, reps=10).exists()


def test_fitness_add_workout_validation(authenticated_client):
    """POST with empty sets returns 400."""
    _, client = authenticated_client()

    exercise = Exercise.objects.create(name=f"test-validation-{faker.uuid4()}")

    url = urls.reverse("fitness-add-workout", kwargs={"exercise_uuid": exercise.uuid})
    resp = client.post(url, {"sets": []}, content_type="application/json")
    assert resp.status_code == 400
