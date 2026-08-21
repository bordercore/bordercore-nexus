import datetime
import tempfile
import zipfile
from pathlib import Path
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from botocore.exceptions import NoCredentialsError
from mutagen.id3._util import ID3NoHeaderError

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import CommandError

from music.management.commands.sync_music import (Command, MusicSyncError,
                                                  SongMetadata)
from music.models import Album, Artist, Song, SongSource


@pytest.fixture
def test_user(db):
    return User.objects.create(username="Test User")


@pytest.fixture
def test_artist(test_user):
    return Artist.objects.create(name="Test Artist", user=test_user)


@pytest.fixture
def test_album(test_artist, test_user):
    return Album.objects.create(
        title="Test Album",
        artist=test_artist,
        year=datetime.datetime.now().year,
        user=test_user
    )


@pytest.fixture
def test_source():
    return SongSource.objects.create(name="Test Song Source")


@pytest.fixture
def test_song(test_artist, test_album, test_source, test_user):
    return Song.objects.create(
        title="Test Song",
        artist=test_artist,
        album=test_album,
        track=1,
        source=test_source,
        uuid=uuid4(),
        user=test_user
    )


@pytest.fixture
def command_instance():
    return Command()


@pytest.fixture
def temp_dir():
    path = tempfile.mkdtemp()
    yield path
    import shutil
    shutil.rmtree(path, ignore_errors=True)


def test_valid_metadata_creation():
    metadata = SongMetadata(
        artist="Test Artist",
        title="Test Song",
        album_name="Test Album",
        track_number="01"
    )
    assert metadata.artist == "Test Artist"
    assert metadata.title == "Test Song"
    assert metadata.album_name == "Test Album"
    assert metadata.track_number == "01"


def test_required_fields_validation():
    with pytest.raises(ValueError, match="Artist is required"):
        SongMetadata(artist="", title="Test Song")
    with pytest.raises(ValueError, match="Title is required"):
        SongMetadata(artist="Test Artist", title="")


def test_optional_fields():
    metadata = SongMetadata(artist="Test Artist", title="Test Song")
    assert metadata.artist == "Test Artist"
    assert metadata.title == "Test Song"
    assert metadata.album_name is None
    assert metadata.track_number is None


@patch("music.management.commands.sync_music.boto3.client")
def test_get_s3_client_success(mock_boto_client, command_instance):
    mock_client = Mock()
    mock_boto_client.return_value = mock_client
    client = command_instance._get_s3_client()
    assert client == mock_client
    mock_boto_client.assert_called_once_with("s3")


@patch("music.management.commands.sync_music.boto3.client")
def test_get_s3_client_no_credentials(mock_boto_client, command_instance):
    mock_boto_client.side_effect = NoCredentialsError()
    with pytest.raises(MusicSyncError, match="AWS credentials not configured"):
        command_instance._get_s3_client()


def test_normalize_track_number(command_instance):
    assert command_instance._normalize_track_number("1") == "01"
    assert command_instance._normalize_track_number("12") == "12"
    assert command_instance._normalize_track_number("1/12") == "01"
    assert command_instance._normalize_track_number("10/12") == "10"


def test_sanitize_filename(command_instance):
    assert command_instance._sanitize_filename("normal_name") == "normal_name"
    assert command_instance._sanitize_filename("bad/name") == "bad-name"
    assert command_instance._sanitize_filename("bad<>name") == "bad--name"
    assert command_instance._sanitize_filename("") == ""
    assert command_instance._sanitize_filename("  spaced  ") == "spaced"


def test_sanitize_tag(command_instance):
    assert command_instance._sanitize_tag("Normal Song") == "Normal Song"
    assert command_instance._sanitize_tag("Explicit Song [Explicit]") == "Explicit Song"
    assert command_instance._sanitize_tag("  Spaced  ") == "Spaced"
    assert command_instance._sanitize_tag("") == ""


@patch.object(Command, "_ensure_directory_exists")
def test_get_artist_directory_regular_artist(mock_ensure, command_instance, test_song):
    result = command_instance._get_artist_directory(Song.objects.filter(id=test_song.id), "Test Artist")
    expected = f"{settings.MUSIC_DIR}/t/Test Artist"
    assert result == expected
    mock_ensure.assert_called_once()


@patch.object(Command, "_ensure_directory_exists")
def test_get_artist_directory_compilation(mock_ensure, command_instance, test_song, test_album):
    test_album.compilation = True
    test_album.save()
    result = command_instance._get_artist_directory(Song.objects.filter(id=test_song.id), "Various Artists")
    expected = f"{settings.MUSIC_DIR}/v/Various"
    assert result == expected
    mock_ensure.assert_called_once()


def test_get_artist_directory_no_song(command_instance):
    with pytest.raises(MusicSyncError, match="No song object found"):
        command_instance._get_artist_directory(Song.objects.none(), "Test Artist")


def test_get_file_path_album_song(command_instance):
    metadata = SongMetadata(
        artist="Test Artist",
        title="Test Song",
        album_name="Test Album",
        track_number="01"
    )
    result = command_instance._get_file_path("/music/artist", metadata, True)
    assert result == "/music/artist/Test Album/01 - Test Song.mp3"


def test_get_file_path_single_song(command_instance):
    metadata = SongMetadata(artist="Test Artist", title="Test Song")
    result = command_instance._get_file_path("/music/artist", metadata, False)
    assert result == "/music/artist/Test Song.mp3"


@patch("music.management.commands.sync_music.EasyID3")
def test_get_id3_info_success(mock_easy_id3, command_instance):
    mock_data = {"artist": ["Test Artist"], "title": ["Test Song"]}
    mock_easy_id3.return_value = mock_data
    assert command_instance._get_id3_info("file.mp3") == mock_data


@patch("music.management.commands.sync_music.EasyID3")
def test_get_id3_info_no_header(mock_easy_id3, command_instance):
    mock_easy_id3.side_effect = ID3NoHeaderError()
    assert command_instance._get_id3_info("file.mp3") == {}


def test_get_id3_tag_present(command_instance):
    data = {"artist": ["Test Artist"]}
    assert command_instance._get_id3_tag("artist", data) == "Test Artist"


def test_get_id3_tag_missing_required(command_instance):
    with pytest.raises(MusicSyncError):
        command_instance._get_id3_tag("artist", {}, required=True)


def test_get_id3_tag_missing_optional(command_instance):
    assert command_instance._get_id3_tag("album", {}, required=False) is None


def test_resolve_metadata_from_args(command_instance):
    data = {"artist": ["ID3 Artist"], "title": ["ID3 Title"]}
    meta = command_instance._resolve_metadata(data, artist="CLI Artist", title="CLI Title", album_name=None, is_album_song=False)
    assert meta.artist == "CLI Artist" and meta.title == "CLI Title"


def test_resolve_metadata_from_id3(command_instance):
    data = {"artist": ["ID3 Artist"], "title": ["ID3 Title"], "album": ["ID3 Album"], "tracknumber": ["5/12"]}
    meta = command_instance._resolve_metadata(data, artist=None, title=None, album_name=None, is_album_song=True)
    assert meta.track_number == "05" and meta.album_name == "ID3 Album"


def test_resolve_metadata_missing_artist(command_instance):
    with pytest.raises(MusicSyncError):
        command_instance._resolve_metadata({"title": ["No Artist"]}, None, None, None, False)


def test_verify_song_in_db_by_uuid(command_instance, test_song):
    result = command_instance._verify_song_in_db(SongMetadata(artist="Test", title="Test"), song_uuid=str(test_song.uuid), is_album_song=False)
    assert result.first() == test_song


def test_verify_song_in_db_by_metadata(command_instance, test_song):
    metadata = SongMetadata(artist="Test Artist", title="Test Song", album_name="Test Album")
    result = command_instance._verify_song_in_db(metadata, None, True)
    assert result.first() == test_song


def test_verify_song_in_db_not_found(command_instance, test_song):
    with pytest.raises(MusicSyncError):
        command_instance._verify_song_in_db(SongMetadata(artist="Missing", title="Missing"), None, False)


def test_verify_song_in_db_multiple_found(command_instance, test_song, test_user, test_artist, test_source):
    Song.objects.create(title="Test Song", artist=test_artist, source=test_source, uuid=uuid4(), user=test_user)
    with pytest.raises(MusicSyncError):
        command_instance._verify_song_in_db(SongMetadata(artist="Test Artist", title="Test Song"), None, False)


@patch.object(Command, "_get_id3_info")
@patch.object(Command, "_get_artist_directory")
@patch.object(Command, "_get_file_path")
@patch.object(Command, "_verify_song_in_db")
@patch("music.management.commands.sync_music.shutil.move")
def test_sync_file_success(mock_move, mock_verify, mock_get_file_path, mock_get_artist_dir, mock_get_id3, command_instance, test_song, temp_dir):
    mock_verify.return_value = Song.objects.filter(pk=test_song.pk)
    mp3_path = Path(temp_dir) / "test.mp3"
    mp3_path.touch()
    command_instance._sync_file(str(mp3_path), artist=test_song.artist.name, title=test_song.title, album_name=None, song_uuid=None, is_album_song=False)
    mock_move.assert_called_once()


@patch.object(Command, "_get_s3_client")
@patch("music.management.commands.sync_music.settings")
def test_download_from_s3_success(mock_settings, mock_get_s3, command_instance, test_song):
    mock_settings.AWS_BUCKET_NAME_MUSIC = "test-bucket"
    mock_s3 = Mock()
    mock_get_s3.return_value = mock_s3
    command_instance._download_from_s3(str(test_song.uuid))
    mock_s3.download_file.assert_called_once()


def test_download_from_s3_song_not_found(command_instance, db):
    with pytest.raises(MusicSyncError):
        command_instance._download_from_s3(str(uuid4()))


def test_sync_directory_no_files(command_instance, temp_dir):
    empty = Path(temp_dir) / "empty"
    empty.mkdir()
    command_instance._sync_directory(str(empty), None, None, False)


@patch.object(Command, "_sync_file")
def test_sync_directory_with_files(mock_sync, command_instance, temp_dir):
    p1 = Path(temp_dir) / "song1.mp3"; p2 = Path(temp_dir) / "song2.mp3"
    p1.touch(); p2.touch()
    command_instance._sync_directory(str(temp_dir), "Artist", "Album", True)
    assert mock_sync.call_count == 2


def test_sync_directory_invalid_path(command_instance):
    with pytest.raises(MusicSyncError):
        command_instance._sync_directory("/nonexistent", None, None, False)


@patch.object(Command, "_sync_directory")
def test_sync_zip_extracts_mp3s_as_album_songs(mock_sync, command_instance, temp_dir):
    zip_path = Path(temp_dir) / "album.zip"
    with zipfile.ZipFile(zip_path, "w") as archive:
        archive.writestr("disc/song.mp3", b"mp3 data")
        archive.writestr("cover.jpg", b"image data")

    command_instance._sync_zip(str(zip_path), "Artist", "Album")

    args = mock_sync.call_args.args
    extracted_dir = Path(args[0])
    assert args[1:] == ("Artist", "Album")
    assert mock_sync.call_args.kwargs == {"is_album_song": True}
    assert not extracted_dir.exists()


def test_sync_zip_rejects_unsafe_paths(command_instance, temp_dir):
    zip_path = Path(temp_dir) / "unsafe.zip"
    with zipfile.ZipFile(zip_path, "w") as archive:
        archive.writestr("../song.mp3", b"mp3 data")

    with pytest.raises(MusicSyncError, match="Unsafe path"):
        command_instance._sync_zip(str(zip_path), None, None)


@patch.object(Command, "_sync_zip")
def test_handle_with_zip(mock_sync, command_instance, db):
    command_instance.handle(
        zip_file="album.zip", artist="Artist", album_name="Album"
    )
    mock_sync.assert_called_once_with("album.zip", "Artist", "Album")


@patch.object(Command, "_download_from_s3")
def test_handle_with_uuid(mock_download, command_instance, test_song):
    command_instance.handle(uuid=str(test_song.uuid))
    mock_download.assert_called_once()


@patch.object(Command, "_sync_directory")
def test_handle_with_directory(mock_sync, db, command_instance):
    command_instance.handle(directory="/test/dir", artist="Artist")
    mock_sync.assert_called_once()


@patch.object(Command, "_download_from_s3")
def test_handle_exception_handling(mock_download, command_instance, db):
    mock_download.side_effect = Exception("Test error")
    with pytest.raises(CommandError):
        command_instance.handle(uuid="test-uuid")
