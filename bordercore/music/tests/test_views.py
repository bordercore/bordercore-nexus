import json
from pathlib import Path

import factory
import pytest

from django import urls
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.models import signals
from django.test import Client

from accounts.tests.factories import TEST_PASSWORD, UserFactory
from music.models import Album, Playlist, Song, SongSource
from music.tests.factories import AlbumFactory, ArtistFactory

pytestmark = [pytest.mark.django_db]


@pytest.fixture
def monkeypatch_song(monkeypatch):
    """Prevent the song object from interacting with Elasticsearch."""

    def mock(*args, **kwargs):
        pass

    monkeypatch.setattr(Song, "delete", mock)


@pytest.fixture
def other_user_client():
    """Create a second authenticated user with their own client."""
    user = UserFactory(username="otheruser")
    client = Client()
    client.login(username="otheruser", password=TEST_PASSWORD)
    return user, client


def test_music_list(authenticated_client, song):
    """Test the main music list page renders successfully."""
    _, client = authenticated_client()

    url = urls.reverse("music:list")
    resp = client.get(url)

    assert resp.status_code == 200


@factory.django.mute_signals(signals.post_save)
def test_music_song_update(authenticated_client, song, song_source):
    """Test updating a song's metadata."""
    _, client = authenticated_client()

    # The submitted form
    url = urls.reverse("music:update", kwargs={"uuid": song[1].uuid})
    resp = client.post(url, {
        "Go": "Update",
        "artist": "Artist Changed",
        "title": "Title Changed",
        "source": song_source.id,
        "tags": "django"
    })

    assert resp.status_code == 302

    url = urls.reverse("music:update", kwargs={"uuid": song[1].uuid})
    resp = client.post(url, {
        "Go": "Delete",
        "tags": ""
    })

    assert resp.status_code == 200


def test_music_artist_list(authenticated_client, song):
    """Test the artist list page renders successfully."""
    _, client = authenticated_client()

    url = urls.reverse("music:artist_list")
    resp = client.get(url)

    assert resp.status_code == 200


def test_music_album_detail(authenticated_client, song):
    """Test the album detail page renders successfully."""
    _, client = authenticated_client()

    url = urls.reverse("music:album_detail", kwargs={"uuid": song[1].album.uuid})
    resp = client.get(url)

    assert resp.status_code == 200


def test_music_album_update(authenticated_client, song):
    """Test updating an album's metadata and tags."""
    _, client = authenticated_client()

    url = urls.reverse("music:album_update", kwargs={"uuid": song[1].album.uuid})
    resp = client.post(url, {
        "title": "New Album Title",
        "artist": "New Artist",
        "year": "2013",
        "note": "New Note",
        "tags": "django",
    })

    assert resp.status_code == 302

    updated_album = Album.objects.get(uuid=song[1].album.uuid)
    assert updated_album.title == "New Album Title"
    assert updated_album.artist.name == "New Artist"
    assert updated_album.year == 2013
    assert updated_album.note == "New Note"
    assert "django" in [x.name for x in updated_album.tags.all()]


def test_music_artist_detail(authenticated_client, song):
    """Test the artist detail page renders successfully."""
    _, client = authenticated_client()

    url = urls.reverse("music:artist_detail", kwargs={"uuid": song[1].artist.uuid})
    resp = client.get(url)

    assert resp.status_code == 200


@factory.django.mute_signals(signals.post_save)
def test_music_create(s3_resource, s3_bucket, authenticated_client, song_source):
    """Test creating a new song with file upload."""
    user, client = authenticated_client()

    # The empty form
    url = urls.reverse("music:create")
    resp = client.get(url)

    assert resp.status_code == 200

    # Adding a new song
    mp3 = Path(__file__).parent / "resources/Mysterious Lights.mp3"

    with open(mp3, "rb") as f:
        song_blob = f.read()

    url = urls.reverse("music:create")

    song_upload = SimpleUploadedFile(mp3.name, song_blob)
    resp = client.post(url, {
        "song": song_upload,
        "artist": "Bryan Teoh",
        "title": "Mysterious Lights",
        "album_name": "FreePD Music",
        "original_release_year": "",
        "source": song_source.id,
        "year": 2020,
        "tags": "synthwave",
        "Go": "Create"
    })

    assert resp.status_code == 302


@factory.django.mute_signals(signals.pre_delete)
def test_music_delete(monkeypatch_song, authenticated_client, song):
    """Test deleting a song."""
    _, client = authenticated_client()

    url = urls.reverse("music:delete", kwargs={"uuid": song[0].uuid})
    resp = client.post(url)

    assert resp.status_code == 302


def test_music_recent_songs(authenticated_client, song):
    """Test the recent songs endpoint returns successfully."""
    _, client = authenticated_client()

    url = urls.reverse("music:recent_songs")
    resp = client.get(url)

    assert resp.status_code == 200


def test_music_search_tag(authenticated_client, song, tag):
    """Test tag search returns matching songs and albums."""
    _, client = authenticated_client()

    url = urls.reverse("music:search_tag")
    resp = client.get(f"{url}?tag={tag[0].name}")

    assert resp.status_code == 200
    assert "songs_json" in resp.context
    assert "albums_json" in resp.context
    assert resp.context["tag_name"] == tag[0].name

    # Verify that the tagged song appears in results
    song_list = resp.context["song_list"]
    song_uuids = [s["uuid"] for s in song_list]
    assert str(song[0].uuid) in song_uuids


def test_mark_song_as_listened_to(authenticated_client, song):
    """Test marking a song as listened to."""
    _, client = authenticated_client()

    url = urls.reverse(
        "mark_song_as_listened_to",
        kwargs={"song_uuid": song[0].uuid}
    )
    resp = client.post(url)

    assert resp.status_code == 200


def test_music_playlist_detail(authenticated_client, playlist):
    """Test the playlist detail page renders successfully."""
    _, client = authenticated_client()

    url = urls.reverse("music:playlist_detail", kwargs={"uuid": playlist[0].uuid})
    resp = client.get(url)

    assert resp.status_code == 200


def test_music_playlist_create(authenticated_client, song):
    """Test creating a new playlist."""
    _, client = authenticated_client()

    url = urls.reverse("music:playlist_create")

    resp = client.post(url, {
        "name": "Test Playlist",
        "type": "manual",
        "tag": "django",
    })

    assert resp.status_code == 302


def test_music_playlist_update(authenticated_client, playlist):
    """Test updating a playlist's metadata."""
    _, client = authenticated_client()

    url = urls.reverse("music:playlist_update", kwargs={"uuid": playlist[0].uuid})
    resp = client.post(url, {
        "name": "Test Playlist New Name",
        "note": "New Note",
        "type": "manual",
        "tag": "django",
    })

    assert resp.status_code == 302

    updated_playlist = Playlist.objects.get(uuid=playlist[0].uuid)
    assert updated_playlist.name == "Test Playlist New Name"
    assert updated_playlist.note == "New Note"


def test_music_playlist_delete(authenticated_client, playlist):
    """Test deleting a playlist."""
    _, client = authenticated_client()

    url = urls.reverse("music:delete_playlist", kwargs={"uuid": playlist[0].uuid})
    resp = client.post(url, {
        "Go": "Confirm"
    })

    assert resp.status_code == 302


def test_music_get_playlist(authenticated_client, playlist):
    """Test retrieving playlist contents via API."""
    _, client = authenticated_client()

    url = urls.reverse("music:get_playlist", kwargs={"playlist_uuid": playlist[0].uuid})
    resp = client.get(url)
    assert resp.status_code == 200

    url = urls.reverse("music:get_playlist", kwargs={"playlist_uuid": playlist[1].uuid})
    resp = client.get(url)
    assert resp.status_code == 200


def test_music_sort_playlist(authenticated_client, playlist):
    """Test reordering a song within a playlist."""
    _, client = authenticated_client()

    url = urls.reverse("music:sort_playlist")
    resp = client.post(url, {
        "playlistitem_uuid": playlist[0].playlistitem_set.order_by("sort_order")[0].uuid,
        "position": 2
    })

    assert resp.status_code == 200


def test_music_search_playlists(authenticated_client, playlist):
    """Test searching playlists by name."""
    _, client = authenticated_client()

    url = urls.reverse("music:search_playlists")
    resp = client.get(f"{url}?query=playlist")

    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["uuid"] == str(playlist[0].uuid)


def test_music_add_to_playlist(authenticated_client, playlist, song):
    """Test adding a song to a playlist."""
    _, client = authenticated_client()

    url = urls.reverse("music:add_to_playlist")
    resp = client.post(url, {
        "playlist_uuid": playlist[0].uuid,
        "song_uuid": song[2].uuid
    })

    assert resp.status_code == 201
    assert resp.json()["action"] == "added"


def test_music_dupe_song_checker(authenticated_client, song):
    """Test duplicate song detection endpoint."""
    _, client = authenticated_client()

    url = urls.reverse("music:dupe_song_checker")
    resp = client.get(f"{url}?artist=New+Artist&title=New+Title")

    assert resp.status_code == 200
    assert resp.json()["dupes"] == []

    resp = client.get(f"{url}?artist={song[0].artist}&title={song[0].title}")

    assert resp.status_code == 200
    response = resp.json()
    assert response["dupes"][0]["title"] == song[0].title
    assert response["dupes"][0]["uuid"] == str(song[0].uuid)


def test_music_recent_albums(authenticated_client):
    """Test paginated recent albums endpoint."""
    user, client = authenticated_client()

    artist = ArtistFactory(user=user)
    albums = AlbumFactory.create_batch(20, artist=artist, user=user)

    url = urls.reverse("music:recent_albums", kwargs={"page_number": 1})
    resp = client.get(url)

    assert resp.status_code == 200
    album_list = resp.json()["album_list"]
    assert len(album_list) == 9
    assert str(albums[-1].uuid) in [x["uuid"] for x in album_list]
    assert str(albums[0].uuid) not in [x["uuid"] for x in album_list]

    url = urls.reverse("music:recent_albums", kwargs={"page_number": 3})
    resp = client.get(url)

    assert resp.status_code == 200
    album_list = resp.json()["album_list"]
    assert len(album_list) == 2
    assert str(albums[-1].uuid) not in [x["uuid"] for x in album_list]
    assert str(albums[0].uuid) in [x["uuid"] for x in album_list]


def test_music_set_song_rating(authenticated_client, song):
    """Test setting a valid song rating."""
    _, client = authenticated_client()

    url = urls.reverse("music:set_song_rating")
    resp = client.post(url, {
        "song_uuid": song[0].uuid,
        "rating": 3
    })

    assert resp.status_code == 200

    updated_song = Song.objects.get(uuid=song[0].uuid)
    assert updated_song.rating == 3


# ---------------------------------------------------------------------------
# Negative / validation tests for API endpoints
# ---------------------------------------------------------------------------


def test_set_song_rating_invalid_value(authenticated_client, song):
    """Test that a non-numeric rating returns 400."""
    _, client = authenticated_client()

    url = urls.reverse("music:set_song_rating")
    resp = client.post(url, {"song_uuid": song[0].uuid, "rating": "abc"})

    assert resp.status_code == 400
    assert "detail" in resp.json()


def test_set_song_rating_out_of_range(authenticated_client, song):
    """Test that a rating outside 1-5 returns 400."""
    _, client = authenticated_client()

    url = urls.reverse("music:set_song_rating")

    resp = client.post(url, {"song_uuid": song[0].uuid, "rating": 0})
    assert resp.status_code == 400

    resp = client.post(url, {"song_uuid": song[0].uuid, "rating": 6})
    assert resp.status_code == 400


def test_set_song_rating_clear(authenticated_client, song):
    """Test that an empty rating clears the value to None."""
    _, client = authenticated_client()

    url = urls.reverse("music:set_song_rating")
    resp = client.post(url, {"song_uuid": song[0].uuid, "rating": ""})

    assert resp.status_code == 200
    updated_song = Song.objects.get(uuid=song[0].uuid)
    assert updated_song.rating is None


def test_sort_playlist_invalid_position(authenticated_client, playlist):
    """Test that a non-numeric position returns 400."""
    _, client = authenticated_client()

    url = urls.reverse("music:sort_playlist")
    resp = client.post(url, {
        "playlistitem_uuid": playlist[0].playlistitem_set.order_by("sort_order")[0].uuid,
        "position": "abc"
    })

    assert resp.status_code == 400
    assert "detail" in resp.json()


def test_search_tag_without_param(authenticated_client):
    """Test that the tag search page handles missing tag parameter gracefully."""
    _, client = authenticated_client()

    url = urls.reverse("music:search_tag")
    resp = client.get(url)

    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Authorization / user-scoping tests
# ---------------------------------------------------------------------------


def test_playlist_detail_blocked_for_other_user(authenticated_client, other_user_client, playlist):
    """Test that a user cannot view another user's playlist."""
    _, other_client = other_user_client

    url = urls.reverse("music:playlist_detail", kwargs={"uuid": playlist[0].uuid})
    resp = other_client.get(url)

    assert resp.status_code == 404


def test_playlist_update_blocked_for_other_user(authenticated_client, other_user_client, playlist):
    """Test that a user cannot update another user's playlist."""
    _, other_client = other_user_client

    url = urls.reverse("music:playlist_update", kwargs={"uuid": playlist[0].uuid})
    resp = other_client.post(url, {
        "name": "Hijacked",
        "type": "manual",
    })

    assert resp.status_code == 404


def test_album_detail_blocked_for_other_user(authenticated_client, other_user_client, song):
    """Test that a user cannot view another user's album."""
    _, other_client = other_user_client

    url = urls.reverse("music:album_detail", kwargs={"uuid": song[1].album.uuid})
    resp = other_client.get(url)

    assert resp.status_code == 404


def test_song_update_blocked_for_other_user(authenticated_client, other_user_client, song):
    """Test that a user cannot update another user's song."""
    _, other_client = other_user_client

    url = urls.reverse("music:update", kwargs={"uuid": song[1].uuid})
    resp = other_client.get(url)

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# add_album_from_zipfile streaming
# ---------------------------------------------------------------------------


def _read_ndjson(streaming_response):
    body = b"".join(streaming_response.streaming_content).decode("utf-8")
    return [json.loads(line) for line in body.splitlines() if line]


def test_add_album_from_zipfile_streams_progress(
    s3_resource, s3_bucket, authenticated_client, song_source
):
    """Streaming view emits start, per-song progress, and a final done event."""
    _, client = authenticated_client()
    source = SongSource.objects.get(name=SongSource.DEFAULT)

    album_zip = Path(__file__).parent / "resources/test-album.zip"
    with open(album_zip, "rb") as f:
        zipfile_blob = f.read()

    url = urls.reverse("music:add_album_from_zipfile")
    resp = client.post(url, {
        "zipfile": SimpleUploadedFile("test-album.zip", zipfile_blob),
        "artist": "U2",
        "source": source.id,
        "tags": "rock",
        "songListChanges": "{}",
    })

    assert resp.status_code == 200
    assert resp["Content-Type"] == "application/x-ndjson"

    events = _read_ndjson(resp)
    assert events[0] == {"type": "start", "total": 2}
    progress = [e for e in events if e["type"] == "progress"]
    assert [e["current"] for e in progress] == [1, 2]
    assert all(e["total"] == 2 for e in progress)
    assert events[-1]["type"] == "done"
    assert events[-1]["url"].startswith("/music/album/")


def test_add_album_from_zipfile_streams_error_on_failure(
    s3_resource, s3_bucket, authenticated_client, song_source, monkeypatch
):
    """Mid-stream S3 failure ends the stream with an error event, status 200."""
    _, client = authenticated_client()
    source = SongSource.objects.get(name=SongSource.DEFAULT)

    def raise_on_upload(self, song_bytes):
        raise RuntimeError("S3 boom")

    monkeypatch.setattr(Song, "upload_song_media_to_s3", raise_on_upload)

    album_zip = Path(__file__).parent / "resources/test-album.zip"
    with open(album_zip, "rb") as f:
        zipfile_blob = f.read()

    url = urls.reverse("music:add_album_from_zipfile")
    resp = client.post(url, {
        "zipfile": SimpleUploadedFile("test-album.zip", zipfile_blob),
        "artist": "U2",
        "source": source.id,
        "songListChanges": "{}",
    })

    assert resp.status_code == 200
    events = _read_ndjson(resp)
    assert events[0]["type"] == "start"
    assert events[-1] == {"type": "error", "detail": "S3 boom"}
    assert Album.objects.count() == 0


def test_add_album_from_zipfile_missing_zip_returns_400(
    authenticated_client, song_source
):
    """Pre-stream validation: missing zipfile returns a 400 JSON response."""
    _, client = authenticated_client()
    source = SongSource.objects.get(name=SongSource.DEFAULT)

    url = urls.reverse("music:add_album_from_zipfile")
    resp = client.post(url, {"artist": "U2", "source": source.id})

    assert resp.status_code == 400
    assert "detail" in resp.json()


def test_recent_songs_includes_album_rating_plays(authenticated_client):
    from django.urls import reverse

    from music.models import Listen
    from music.tests.factories import SongFactory

    user, client = authenticated_client()
    song_no_album = SongFactory.create(user=user, album=None, rating=5)
    song_with_listens = SongFactory.create(user=user, album=None, rating=3)
    Listen.objects.create(user=user, song=song_with_listens)
    Listen.objects.create(user=user, song=song_with_listens)

    response = client.get(reverse("music:recent_songs"))
    assert response.status_code == 200
    songs_by_uuid = {str(s["uuid"]): s for s in response.json()["song_list"]}

    s_a = songs_by_uuid[str(song_no_album.uuid)]
    assert "album_title" in s_a
    assert s_a["album_title"] is None
    assert s_a["rating"] == 5
    assert s_a["plays"] == 0

    s_b = songs_by_uuid[str(song_with_listens.uuid)]
    assert s_b["plays"] == 2
    assert s_b["rating"] == 3


def test_music_list_passes_dashboard_stats(authenticated_client):
    from django.urls import reverse
    from music.tests.factories import SongFactory

    user, client = authenticated_client()
    SongFactory.create(user=user)
    response = client.get(reverse("music:list"))
    assert response.status_code == 200
    assert b"data-dashboard-stats" in response.content


def test_music_list_playlists_have_type_and_parameters(authenticated_client):
    import json
    from django.urls import reverse
    from music.tests.factories import PlaylistFactory, SongFactory

    user, client = authenticated_client()
    SongFactory.create(user=user)
    p = PlaylistFactory.create(user=user, type="smart", parameters={"tag": "ambient"})

    response = client.get(reverse("music:list"))
    assert response.status_code == 200
    body = response.content.decode()
    needle = 'data-playlists="'
    start = body.index(needle) + len(needle)
    end = body.index('"', start)
    raw = body[start:end].replace("&quot;", '"')
    playlists = json.loads(raw)
    smart = next((pl for pl in playlists if pl["uuid"] == str(p.uuid)), None)
    assert smart is not None
    assert smart["type"] == "smart"
    assert smart["parameters"] == {"tag": "ambient"}
