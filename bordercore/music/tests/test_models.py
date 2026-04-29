from pathlib import Path

import pytest

from music.models import Album, Artist, Listen, Song, SongSource
from music.services import (create_album_from_zipfile, get_id3_info,
                            scan_zipfile)
from music.tests.factories import AlbumFactory, SongFactory

pytestmark = [pytest.mark.django_db]


def test_listen_to(authenticated_client, song):
    """Test that listen_to increments play count and creates a Listen record."""
    song[0].listen_to()
    song[0].refresh_from_db()
    assert song[0].times_played == 1
    assert Listen.objects.all().count() == 2
    assert Listen.objects.first().song == song[0]


def test_get_id3_info(authenticated_client, song):
    """Test extracting ID3 metadata from an MP3 file."""
    song_path = Path(__file__).parent / "resources/Mysterious Lights.mp3"

    with open(song_path, "rb") as f:
        song_file = f.read()

    song_info = get_id3_info(song_file)

    # A song with an album
    assert song_info["artist"] == "Bryan Teoh"
    assert song_info["title"] == "Mysterious Lights"
    assert song_info["year"] == "2020"
    assert song_info["album_name"] == "FreePD Music"
    assert song_info["length"] == 178
    assert song_info["length_pretty"] == "2:58"


def test_music_playtime():
    """Test album playtime calculation from song lengths."""
    album = AlbumFactory()
    SongFactory.create_batch(10, length=300, album=album)

    assert album.playtime == "50 minutes"


def test_music_song_url():
    """Test that song URL returns album page or artist page as appropriate."""
    # Test url for a song that's part of an album
    album = AlbumFactory()
    songs = SongFactory.create_batch(10, length=300, album=album)

    assert songs[0].url == f"/music/album/{album.uuid}/"

    # Test url for a song that's not part of an album
    song = SongFactory(album=None)

    assert song.url == f"/music/artist/{song.artist.uuid}/"


def test_music_scan_zipfile():
    """Test scanning a ZIP file to extract MP3 metadata."""
    album_zip = Path(__file__).parent / "resources/test-album.zip"
    in_file = open(album_zip, "rb")
    zipfile_obj = in_file.read()
    in_file.close()

    info = scan_zipfile(zipfile_obj)
    songs = info["song_info"]

    assert info["album"] == "The Joshua Tree"
    assert info["artist"][0] == "U2"
    assert len(songs) == 2
    assert songs[0]["filesize"] == "7.6 kB"
    assert songs[0]["bit_rate"] == 15999
    assert songs[0]["sample_rate"] == 11025
    assert songs[0]["artist"] == "U2"
    assert songs[0]["title"] == "With or Without You"
    assert songs[0]["album_name"] == "The Joshua Tree"
    assert songs[0]["length"] == 3
    assert songs[0]["length_pretty"] == "0:03"
    assert songs[1]["filesize"] == "7.6 kB"
    assert songs[1]["bit_rate"] == 15999
    assert songs[1]["sample_rate"] == 11025
    assert songs[1]["artist"] == "U2"
    assert songs[1]["title"] == "Running to Stand Still"
    assert songs[1]["album_name"] == "The Joshua Tree"
    assert songs[1]["length"] == 3
    assert songs[1]["length_pretty"] == "0:03"


def test_create_album_from_zipfile(s3_resource, s3_bucket, authenticated_client, song_source):
    """Test creating an album from a ZIP file of MP3s."""
    user, _ = authenticated_client()

    album_zip = Path(__file__).parent / "resources/test-album.zip"
    in_file = open(album_zip, "rb")
    zipfile_obj = in_file.read()
    in_file.close()

    song_source = SongSource.objects.get(name=SongSource.DEFAULT)
    artist_name = "U2"
    tags = "rock"

    events = list(create_album_from_zipfile(
        zipfile_obj,
        artist_name,
        song_source,
        tags=tags,
        user=user,
        changes={}
    ))

    assert events[0] == {"type": "start", "total": 2}
    progress = [e for e in events if e["type"] == "progress"]
    assert [e["current"] for e in progress] == [1, 2]
    assert all(e["total"] == 2 for e in progress)
    assert events[-1]["type"] == "done"
    album_uuid = events[-1]["album_uuid"]

    album = Album.objects.get(uuid=album_uuid)
    assert album.compilation is False
    assert album.artist.name == "U2"
    assert album.title == "The Joshua Tree"
    assert album.year == 1987
    assert album.song_set.count() == 2
    song_1 = album.song_set.get(title="Running to Stand Still")
    song_2 = album.song_set.get(title="With or Without You")
    assert song_1.tags.first().name == "rock"
    assert song_1.artist.name == "U2"
    assert song_1.album == album
    assert song_1.track == 5
    assert song_1.year == 1987
    assert song_1.source == song_source
    assert song_1.length == 3
    assert song_2.tags.first().name == "rock"
    assert song_2.artist.name == "U2"
    assert song_2.album == album
    assert song_2.track == 3
    assert song_2.year == 1987
    assert song_2.source == song_source
    assert song_2.length == 3


def test_create_album_from_zipfile_with_changes(s3_resource, s3_bucket, authenticated_client, song_source):
    """Test creating an album from ZIP with user-specified title and note changes."""
    user, _ = authenticated_client()

    album_zip = Path(__file__).parent / "resources/test-album.zip"
    in_file = open(album_zip, "rb")
    zipfile_obj = in_file.read()
    in_file.close()

    song_source = SongSource.objects.get(name=SongSource.DEFAULT)
    artist_name = "U2"
    tags = "rock"

    events = list(create_album_from_zipfile(
        zipfile_obj,
        artist_name,
        song_source,
        tags=tags,
        user=user,
        changes={
            "3": {"note": "Live version"},
            "5": {"title": "Running to Stand Still (feat ...)", "note": "Cover"},
        }
    ))

    assert events[-1]["type"] == "done"
    album = Album.objects.get(uuid=events[-1]["album_uuid"])
    assert album.compilation is False
    assert album.artist.name == "U2"
    assert album.title == "The Joshua Tree"
    assert album.year == 1987
    assert album.song_set.count() == 2
    song_1 = album.song_set.get(title="Running to Stand Still (feat ...)")
    song_2 = album.song_set.get(title="With or Without You")
    assert song_1.tags.first().name == "rock"
    assert song_1.artist.name == "U2"
    assert song_1.title == "Running to Stand Still (feat ...)"
    assert song_1.album == album
    assert song_1.track == 5
    assert song_1.year == 1987
    assert song_1.source == song_source
    assert song_1.length == 3
    assert song_1.note == "Cover"
    assert song_2.tags.first().name == "rock"
    assert song_2.artist.name == "U2"
    assert song_2.title == "With or Without You"
    assert song_2.album == album
    assert song_2.track == 3
    assert song_2.year == 1987
    assert song_2.source == song_source
    assert song_2.length == 3
    assert song_2.note == "Live version"


def test_create_album_from_zipfile_rolls_back_on_failure(
    s3_resource, s3_bucket, authenticated_client, song_source, monkeypatch
):
    """Mid-loop S3 failure rolls back the entire album."""
    user, _ = authenticated_client()

    album_zip = Path(__file__).parent / "resources/test-album.zip"
    with open(album_zip, "rb") as f:
        zipfile_obj = f.read()

    song_source = SongSource.objects.get(name=SongSource.DEFAULT)

    # Fail on the second song's S3 upload.
    call_count = {"n": 0}
    original_upload = Song.upload_song_media_to_s3

    def flaky_upload(self, song_bytes):
        call_count["n"] += 1
        if call_count["n"] >= 2:
            raise RuntimeError("S3 boom")
        return original_upload(self, song_bytes)

    monkeypatch.setattr(Song, "upload_song_media_to_s3", flaky_upload)

    gen = create_album_from_zipfile(
        zipfile_obj, "U2", song_source, tags=None, user=user, changes={}
    )

    with pytest.raises(RuntimeError, match="S3 boom"):
        events = []
        for event in gen:
            events.append(event)

    # First event was the start; one progress event made it out before failure.
    assert events[0]["type"] == "start"
    progress_events = [e for e in events if e["type"] == "progress"]
    assert len(progress_events) == 1

    # Atomic block rolled back: no album, no songs, no artist for this user.
    assert Album.objects.filter(artist__user=user).count() == 0
    assert Song.objects.filter(user=user).count() == 0
    assert Artist.objects.filter(user=user, name="U2").count() == 0
