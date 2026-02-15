import pytest
from faker import Factory as FakerFactory

from music.services import get_unique_artist_letters
from music.tests.factories import AlbumFactory, ArtistFactory

pytestmark = pytest.mark.django_db


faker = FakerFactory.create()


def test_get_unique_artist_letters(authenticated_client):

    user, _ = authenticated_client()

    artist_1 = ArtistFactory.create(user=user, name="Abba")
    artist_2 = ArtistFactory.create(user=user, name="Beatles")
    artist_3 = ArtistFactory.create(user=user, name="3 Doors Down")
    AlbumFactory.create(user=user, artist=artist_1, title=faker.text(max_nb_chars=32))
    AlbumFactory.create(user=user, artist=artist_2, title=faker.text(max_nb_chars=32))
    AlbumFactory.create(user=user, artist=artist_3, title=faker.text(max_nb_chars=32))

    unique_artist_letters = get_unique_artist_letters(user)

    assert unique_artist_letters == {"a", "b", "other"}
