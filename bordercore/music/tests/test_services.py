import io
from datetime import timedelta
from pathlib import Path

import pytest
from faker import Factory as FakerFactory
from mutagen.id3 import APIC, ID3
from PIL import Image

from django.utils import timezone

from music.models import Listen
from music.services import (
    get_dashboard_stats,
    get_id3_info,
    get_recent_albums,
    get_unique_artist_letters,
)
from music.tests.factories import AlbumFactory, ArtistFactory, SongFactory
from tag.tests.factories import TagFactory

pytestmark = [pytest.mark.django_db]


faker = FakerFactory.create()


def test_get_unique_artist_letters(authenticated_client):
    """Test that unique artist first letters are correctly identified."""
    user, _ = authenticated_client()

    artist_1 = ArtistFactory.create(user=user, name="Abba")
    artist_2 = ArtistFactory.create(user=user, name="Beatles")
    artist_3 = ArtistFactory.create(user=user, name="3 Doors Down")
    AlbumFactory.create(user=user, artist=artist_1, title=faker.text(max_nb_chars=32))
    AlbumFactory.create(user=user, artist=artist_2, title=faker.text(max_nb_chars=32))
    AlbumFactory.create(user=user, artist=artist_3, title=faker.text(max_nb_chars=32))

    unique_artist_letters = get_unique_artist_letters(user)

    assert unique_artist_letters == {"a", "b", "other"}


def test_get_dashboard_stats_empty(authenticated_client):
    user, _ = authenticated_client()
    stats = get_dashboard_stats(user)
    assert stats == {
        "plays_this_week": 0,
        "top_tag_7d": None,
        "added_this_month": 0,
        "longest_streak": 0,
        "plays_today": 0,
    }


def test_get_dashboard_stats_counts_listens(authenticated_client):
    user, _ = authenticated_client()
    song = SongFactory.create(user=user)
    now = timezone.now()
    Listen.objects.create(user=user, song=song)
    listen_2 = Listen.objects.create(user=user, song=song)
    listen_2.created = now - timedelta(days=2)
    listen_2.save()
    listen_3 = Listen.objects.create(user=user, song=song)
    listen_3.created = now - timedelta(days=10)
    listen_3.save()

    stats = get_dashboard_stats(user)
    assert stats["plays_this_week"] == 2
    assert stats["plays_today"] == 1


def test_get_dashboard_stats_top_tag(authenticated_client):
    user, _ = authenticated_client()
    song_a = SongFactory.create(user=user)
    song_b = SongFactory.create(user=user)
    tag_synth = TagFactory.create(name="synthwave")
    tag_jazz = TagFactory.create(name="jazz")
    song_a.tags.add(tag_synth)
    song_b.tags.add(tag_jazz)
    Listen.objects.create(user=user, song=song_a)
    Listen.objects.create(user=user, song=song_a)
    Listen.objects.create(user=user, song=song_b)

    stats = get_dashboard_stats(user)
    assert stats["top_tag_7d"] == {"name": "synthwave", "count": 2}


def test_get_dashboard_stats_longest_streak(authenticated_client):
    user, _ = authenticated_client()
    song = SongFactory.create(user=user)
    now = timezone.now()
    for offset in (0, 1, 2, 5, 6):
        listen = Listen.objects.create(user=user, song=song)
        listen.created = now - timedelta(days=offset)
        listen.save()

    stats = get_dashboard_stats(user)
    assert stats["longest_streak"] == 3


def _make_jpeg_bytes(color: tuple[int, int, int] = (200, 80, 40)) -> bytes:
    """Render a tiny in-memory JPEG suitable for embedding as APIC artwork."""
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), color).save(buf, format="JPEG")
    return buf.getvalue()


def test_get_id3_info_returns_none_when_no_artwork():
    """The fixture MP3 carries no APIC frame, so artwork should be None."""
    song_path = Path(__file__).parent / "resources/Mysterious Lights.mp3"
    info = get_id3_info(song_path.read_bytes())
    assert info["artwork"] is None


def test_get_id3_info_extracts_embedded_artwork():
    """An APIC-bearing MP3 round-trips to a base64 image data URL."""
    song_path = Path(__file__).parent / "resources/Mysterious Lights.mp3"
    raw = song_path.read_bytes()

    jpeg = _make_jpeg_bytes()
    tagged = io.BytesIO(raw)
    tags = ID3(tagged)
    tags.add(APIC(encoding=3, mime="image/jpeg", type=3, desc="cover", data=jpeg))
    out = io.BytesIO()
    out.write(raw)
    out.seek(0)
    tags.save(out)
    info = get_id3_info(out.getvalue())

    assert info["artwork"] is not None
    assert info["artwork"].startswith("data:image/jpeg;base64,")
    # The encoded payload must decode back to the bytes we embedded.
    import base64
    encoded = info["artwork"].split(",", 1)[1]
    assert base64.b64decode(encoded) == jpeg


def test_get_recent_albums_includes_extended_fields(authenticated_client):
    user, _ = authenticated_client()
    album = AlbumFactory.create(user=user)
    tag = TagFactory.create(name="ambient", user=user)
    album.tags.add(tag)
    SongFactory.create(user=user, album=album, length=120, rating=4)
    SongFactory.create(user=user, album=album, length=240, rating=2)

    albums, _paginator = get_recent_albums(user, 1)
    assert len(albums) == 1
    a = albums[0]
    assert a["track_count"] == 2
    assert a["playtime"] == "6:00"
    assert a["tags"] == ["ambient"]
    assert a["year"] == album.year
    assert a["rating"] == 3  # rounded average of (4, 2)
    assert a["plays"] == 0


def test_get_recent_albums_aggregates_correctly_with_listens(authenticated_client):
    """Verify aggregate fields aren't inflated by the song→listen cross-join."""
    user, _ = authenticated_client()
    album = AlbumFactory.create(user=user)
    song_a = SongFactory.create(user=user, album=album, length=120, rating=4)
    song_b = SongFactory.create(user=user, album=album, length=240, rating=2)
    for _ in range(3):
        Listen.objects.create(user=user, song=song_a)
    for _ in range(2):
        Listen.objects.create(user=user, song=song_b)

    albums, _ = get_recent_albums(user, 1)
    a = albums[0]
    assert a["track_count"] == 2, "track_count must not include listen fan-out"
    assert a["playtime"] == "6:00", "playtime must be 360s, not inflated by listens"
    assert a["rating"] == 3, "rating must be true mean (3), not play-weighted (3.2)"
    assert a["plays"] == 5
