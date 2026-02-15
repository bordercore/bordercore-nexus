import pytest

from music.models import Listen, SongSource, PlaylistItem
from music.tests.factories import SongFactory, AlbumFactory, PlaylistFactory


@pytest.fixture()
def song_source(authenticated_client):

    song_source, _ = SongSource.objects.get_or_create(name=SongSource.DEFAULT)
    return song_source


@pytest.fixture()
def song(song_source, tag):

    album = AlbumFactory()

    song_0 = SongFactory()
    song_0.tags.add(tag[0])
    song_1 = SongFactory(album=album)
    song_2 = SongFactory()

    listen = Listen(user=song_2.user, song=song_2)
    listen.save()

    yield [song_0, song_1, song_2]


@pytest.fixture()
def playlist(authenticated_client, song, tag):

    user, _ = authenticated_client()

    # Create a "manual" playlist
    playlist_0 = PlaylistFactory(user=user)
    playlistitem = PlaylistItem(playlist=playlist_0, song=song[0])
    playlistitem.save()
    playlistitem = PlaylistItem(playlist=playlist_0, song=song[1])
    playlistitem.save()

    # Create a "smart" playlist
    playlist_1 = PlaylistFactory(user=user, type="tag")
    playlist_1.parameters = {"tag": tag[0].name}
    playlist_1.save()

    yield [playlist_0, playlist_1]
