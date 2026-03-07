import pytest
from django.test import RequestFactory

from music.forms import SongForm
from music.models import SongSource
from music.tests.factories import AlbumFactory, ArtistFactory

pytestmark = [pytest.mark.django_db]


@pytest.fixture
def request_factory(authenticated_client):
    """Build a fake request attached to the authenticated user."""
    user, _ = authenticated_client()
    factory = RequestFactory()
    request = factory.post("/fake/")
    request.user = user
    request.session = {}
    return request


@pytest.fixture
def song_source_obj():
    """Get or create the default SongSource."""
    source, _ = SongSource.objects.get_or_create(name=SongSource.DEFAULT, defaults={"description": ""})
    return source


def test_clean_album_name_year_mismatch(request_factory, song_source_obj):
    """Test validation error when album exists with a different year."""
    user = request_factory.user
    artist = ArtistFactory(user=user)
    AlbumFactory(user=user, artist=artist, title="Existing Album", year=1999)

    form = SongForm(
        data={
            "title": "New Song",
            "artist": artist.name,
            "album_name": "Existing Album",
            "year": 2005,
            "source": song_source_obj.id,
        },
        request=request_factory,
    )

    assert not form.is_valid()
    assert "album_name" in form.errors


def test_clean_album_name_year_matches(request_factory, song_source_obj):
    """Test no validation error when album exists with the same year."""
    user = request_factory.user
    artist = ArtistFactory(user=user)
    AlbumFactory(user=user, artist=artist, title="Existing Album", year=1999)

    form = SongForm(
        data={
            "title": "New Song",
            "artist": artist.name,
            "album_name": "Existing Album",
            "year": 1999,
            "source": song_source_obj.id,
        },
        request=request_factory,
    )

    # album_name should pass validation (other fields may still have errors)
    form.is_valid()
    assert "album_name" not in form.errors


def test_clean_year_required_when_album_specified(request_factory, song_source_obj):
    """Test that year is required when an album name is provided."""
    form = SongForm(
        data={
            "title": "New Song",
            "artist": "Some Artist",
            "album_name": "Some Album",
            "year": "",
            "source": song_source_obj.id,
        },
        request=request_factory,
    )

    assert not form.is_valid()
    assert "year" in form.errors


def test_clean_rating_empty_becomes_none(request_factory, song_source_obj):
    """Test that an empty rating field is cleaned to None."""
    form = SongForm(
        data={
            "title": "New Song",
            "artist": "Some Artist",
            "rating": "",
            "source": song_source_obj.id,
        },
        request=request_factory,
    )

    form.is_valid()
    assert form.cleaned_data.get("rating") is None


def test_clean_rating_valid_value(request_factory, song_source_obj):
    """Test that a valid rating value is preserved."""
    form = SongForm(
        data={
            "title": "New Song",
            "artist": "Some Artist",
            "rating": 4,
            "source": song_source_obj.id,
        },
        request=request_factory,
    )

    form.is_valid()
    assert form.cleaned_data.get("rating") == 4
