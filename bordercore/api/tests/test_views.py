import pytest
from faker import Factory as FakerFactory
from feed.tests.factories import FeedFactory

from django import urls
from django.conf import settings

pytestmark = [pytest.mark.django_db]

from accounts.tests.factories import UserFactory
from blob.tests.factories import BlobFactory
from bookmark.tests.factories import BookmarkFactory
from collection.tests.factories import CollectionFactory
from drill.tests.factories import QuestionFactory
from music.tests.factories import PlaylistFactory, SongFactory
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
