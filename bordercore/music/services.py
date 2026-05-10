"""Django services module for music application.

This module provides service functions for managing playlists, albums, artists,
and search functionality using Django ORM and Elasticsearch.
"""
from __future__ import annotations

import string
import zipfile
from datetime import timedelta
from io import BytesIO
from typing import Any, Iterable, Iterator, TypedDict, cast
from urllib.parse import unquote

import humanize
from elasticsearch import Elasticsearch
from mutagen.easyid3 import EasyID3
from mutagen.mp3 import MP3

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.core.paginator import Page, Paginator
from django.db.models import Avg, Count, FloatField, IntegerField, OuterRef, Q, QuerySet, Subquery, Sum
from django.db.models.functions import Coalesce, TruncDate
from django.urls import reverse
from django.utils import timezone

from lib.aws import s3_delete_object, s3_list_objects, s3_upload_fileobj
from lib.time_utils import convert_seconds
from lib.util import get_elasticsearch_connection
from tag.models import Tag

from .models import Album, Artist, Listen, Playlist, PlaylistItem, Song, SongSource

SEARCH_LIMIT: int = 1000


class TagCount(TypedDict):
    """A TypedDict for representing a tag and its associated count.

    This is typically used as a return type for database queries that
    aggregate tag data.

    Attributes:
        name: The name of the tag.
        count: The number of times the tag has been used.
    """
    name: str
    count: int


def get_playlist_counts(user: User) -> QuerySet[Playlist]:
    """Get all playlists for a user with song counts.

    Retrieves all playlists belonging to the specified user, annotated with
    the number of songs in each playlist. Results are ordered alphabetically
    by playlist name.

    Args:
        user: The user to get playlists for.

    Returns:
        A QuerySet of Playlist objects annotated with 'num_songs' field
        containing the count of playlist items, ordered by name.
    """
    return Playlist.objects.filter(
        user=user
    ).annotate(
        num_songs=Count("playlistitem")
    ).order_by(
        "name"
    )


def get_playlist_songs(playlist: Playlist) -> dict[str, list[dict[str, Any]] | int]:
    """Get all songs in a playlist with metadata and total playtime.

    Retrieves all songs in the specified playlist along with their metadata
    and calculates the total playtime for the entire playlist.

    Args:
        playlist: The Playlist instance to get songs for.

    Returns:
        A dictionary containing:
            - 'song_list': List of dictionaries with song metadata including:
                - playlistitem_uuid: UUID of the playlist item
                - uuid: UUID of the song
                - sort_order: Order of song in playlist
                - artist: Artist name
                - title: Song title
                - note: Song note/description
                - year: Release year
                - length: Formatted song length (e.g., "3:45")
            - 'playtime': Total playtime in seconds for all songs
    """
    playtime: int = PlaylistItem.objects.filter(
        playlist=playlist
    ).aggregate(
        total_time=Coalesce(Sum("song__length"), 0)
    )["total_time"]

    song_list: list[dict[str, Any]] = [
        {
            "playlistitem_uuid": x.uuid,
            "uuid": x.song.uuid,
            "sort_order": x.sort_order,
            "artist": x.song.artist.name,
            "title": x.song.title,
            "note": x.song.note,
            "year": x.song.year,
            "length": convert_seconds(x.song.length)
        }
        for x
        in PlaylistItem.objects.filter(playlist=playlist)
        .select_related("song", "song__artist").order_by("sort_order")
    ]

    return {
        "song_list": song_list,
        "playtime": playtime
    }


def get_recent_albums(user: User, page_number: int = 1) -> tuple[list[dict[str, Any]], dict[str, int | bool | None]]:
    """Get paginated recent albums with extended fields for the dashboard.

    Each album dict contains:
        uuid, title, artist_uuid, artist_name, created (formatted "B Y"),
        album_url, artwork_url, artist_url,
        year, original_release_year,
        track_count: int (distinct songs),
        playtime: str (humanized total seconds),
        tags: list[str] (first 2),
        rating: int | None (rounded average song rating, None if no rated songs),
        plays: int (total Listen rows across the album's songs).
    """
    albums_per_page: int = 9

    song_aggregates = (
        Song.objects.filter(album=OuterRef("pk"))
        .values("album")
        .annotate(
            playtime=Coalesce(Sum("length"), 0),
            avg_rating=Avg("rating"),
            track_count=Count("id"),
        )
    )
    listen_count = (
        Listen.objects.filter(song__album=OuterRef("pk"))
        .values("song__album")
        .annotate(c=Count("id"))
        .values("c")
    )

    query: QuerySet[Album] = (
        Album.objects.filter(user=user)
        .select_related("artist")
        .prefetch_related("tags")
        .annotate(
            _track_count=Subquery(song_aggregates.values("track_count"), output_field=IntegerField()),
            _playtime_seconds=Subquery(song_aggregates.values("playtime"), output_field=IntegerField()),
            _avg_rating=Subquery(song_aggregates.values("avg_rating"), output_field=FloatField()),
            _plays=Coalesce(Subquery(listen_count, output_field=IntegerField()), 0),
        )
        .order_by("-created")
    )

    paginator: Paginator = Paginator(query, albums_per_page)
    page: Page = paginator.get_page(page_number)

    paginator_info: dict[str, int | bool | None] = {
        "page_number": page_number,
        "has_next": page.has_next(),
        "has_previous": page.has_previous(),
        "next_page_number": page.next_page_number() if page.has_next() else None,
        "previous_page_number": page.previous_page_number() if page.has_previous() else None,
        "count": paginator.count,
    }

    recent_albums: list[dict[str, Any]] = [
        {
            "uuid": x.uuid,
            "title": x.title,
            "artist_uuid": x.artist.uuid,
            "artist_name": x.artist.name,
            "created": x.created.strftime("%B %Y"),
            "album_url": reverse("music:album_detail", kwargs={"uuid": x.uuid}),
            "artwork_url": f"{settings.IMAGES_URL}album_artwork/{x.uuid}",
            "artist_url": reverse("music:artist_detail", kwargs={"uuid": x.artist.uuid}),
            "year": x.year,
            "original_release_year": x.original_release_year,
            "track_count": x._track_count or 0,
            "playtime": convert_seconds(x._playtime_seconds or 0),
            "tags": [t.name for t in x.tags.all()][:2],
            "rating": round(x._avg_rating) if x._avg_rating is not None else None,
            "plays": x._plays,
        }
        for x in page.object_list
    ]

    return recent_albums, paginator_info


def get_song_tags(user: User) -> Iterable[TagCount]:
    """Get a count of all song tags, grouped by tag.

    Args:
        user: The user whose song tags to retrieve.

    Returns:
        List of dictionaries containing tag names and their counts, sorted by count descending.
    """
    tags_query = (
        Tag.objects.filter(song__user=user)
        .annotate(count=Count("song", distinct=True))
        .order_by("-count")
        .values("name", "count")
    )

    return cast(Iterable[TagCount], tags_query)


def search(user: User, artist_name: str) -> list[dict[str, str]]:
    """Search for artists using Elasticsearch.

    Searches for artists in Elasticsearch based on a substring match.
    The search is scoped to the specified user's music collection and
    uses autocomplete functionality for efficient matching.

    Args:
        user: The user to scope the search to.
        artist_name: The artist name or substring to search for.

    Returns:
        A list of dictionaries containing matching artists:
            - artist: The artist name

    Raises:
        ConnectionError: If Elasticsearch connection fails.
        RequestError: If the search query is malformed.
    """
    es: Elasticsearch = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

    search_term: str = unquote(artist_name.lower())

    search_object: dict[str, Any] = {
        "query": {
            "bool": {
                "must": [
                    {
                        "term": {
                            "user_id": user.id
                        }
                    },
                    {
                        "bool": {
                            "should": [
                                {
                                    "match": {
                                        "artist.autocomplete": {
                                            "query": search_term,
                                            "operator": "and"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        },
        "aggs": {
            "distinct_artists": {
                "terms": {
                    "field": "artist.keyword",
                    "size": SEARCH_LIMIT
                }
            }
        },
        "from_": 0,
        "size": 0,
        "_source": [""]
    }

    results: dict[str, Any] = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)

    return [
        {
            "artist": x["key"]
        }
        for x
        in
        results["aggregations"]["distinct_artists"]["buckets"]
    ]


def get_unique_artist_letters(user: User) -> set[str]:
    """Get unique first letters of all artist names for a user.

    Retrieves a set of unique first letters from all artist names in the
    user's music collection. Non-alphabetic characters are grouped under 'other'.
    Only includes artists that have at least one album.

    Args:
        user: The user to get artist letters for.

    Returns:
        A set of lowercase letters ('a'-'z') and 'other' for non-alphabetic
        first characters.

    Note:
        Artists without albums are excluded from the results to ensure
        only meaningful entries are included.
    """
    ascii_letters = set(string.ascii_lowercase)
    unique_letters: set[str] = set()
    queryset: QuerySet[Artist] = Artist.objects.filter(user=user) \
                                               .filter(album__isnull=False) \
                                               .distinct("name")

    for artist in queryset:
        first_letter: str = artist.name.lower()[0]
        if first_letter not in ascii_letters:
            unique_letters.add("other")
        else:
            unique_letters.add(first_letter)

    return unique_letters


def get_artist_counts(user: User, letter: str) -> dict[str, dict[str, int]]:
    """Get album and song counts for artists starting with a specific letter.

    Retrieves count statistics for all artists whose names start with the
    specified letter. Provides both album and song counts per artist.

    Args:
        user: The user to get artist counts for.
        letter: The first letter to filter artists by (case-insensitive).

    Returns:
        A dictionary containing:
            - 'album_counts': Dict mapping artist UUID strings to album counts
            - 'song_counts': Dict mapping artist UUID strings to song counts

    Note:
        Only artists with albums are included in album_counts, while
        song_counts includes all artists with songs regardless of albums.
    """
    album_counts: QuerySet[Artist] = Artist.objects.filter(name__istartswith=letter) \
        .filter(user=user) \
        .filter(album__isnull=False) \
        .annotate(album_count=Count("album"))

    song_counts: QuerySet[Artist] = Artist.objects.filter(name__istartswith=letter) \
        .filter(user=user) \
        .annotate(song_count=Count("song"))

    album_counts_dict: dict[str, int] = {}
    for artist in album_counts:
        # mypy doesn't understand Django's annotate(), so we use getattr with type ignore
        album_counts_dict[str(artist.uuid)] = getattr(artist, "album_count")  # type: ignore[attr-defined]

    song_counts_dict: dict[str, int] = {}
    for artist in song_counts:
        # mypy doesn't understand Django's annotate(), so we use getattr with type ignore
        song_counts_dict[str(artist.uuid)] = getattr(artist, "song_count")  # type: ignore[attr-defined]

    return {
        "album_counts": album_counts_dict,
        "song_counts": song_counts_dict
    }


def get_unique_album_letters(user: User) -> set[str]:
    """Get unique first letters of all album titles for a user.

    Non-alphabetic first characters are grouped under 'other'.

    Args:
        user: The user whose albums to inspect.

    Returns:
        A set of lowercase letters and 'other'.
    """
    ascii_letters = set(string.ascii_lowercase)
    unique_letters: set[str] = set()
    queryset: QuerySet[Album] = Album.objects.filter(user=user)

    for album in queryset.only("title"):
        if not album.title:
            continue
        first_letter = album.title.lower()[0]
        if first_letter not in ascii_letters:
            unique_letters.add("other")
        else:
            unique_letters.add(first_letter)

    return unique_letters


def get_albums_by_letter(user: User, letter: str) -> list[dict[str, Any]]:
    """Get all albums whose title starts with the given letter.

    Args:
        user: The user whose albums to fetch.
        letter: A lowercase letter ('a'-'z') or 'other' for non-alphabetic titles.

    Returns:
        A list of album dicts with uuid, title, artist_name, artist_uuid,
        album_url, artist_url, artwork_url, year, track_count.
    """
    track_count = (
        Song.objects.filter(album=OuterRef("pk"))
        .values("album")
        .annotate(c=Count("id"))
        .values("c")
    )

    queryset: QuerySet[Album] = (
        Album.objects.filter(user=user)
        .select_related("artist")
        .annotate(_track_count=Coalesce(Subquery(track_count, output_field=IntegerField()), 0))
    )

    if letter == "other":
        queryset = queryset.exclude(
            Q(*[
                ("title__istartswith", l)
                for l in string.ascii_lowercase
            ], _connector=Q.OR)
        )
    else:
        queryset = queryset.filter(title__istartswith=letter)

    queryset = queryset.order_by("title")

    return [
        {
            "uuid": str(album.uuid),
            "title": album.title,
            "artist_name": album.artist.name,
            "artist_uuid": str(album.artist.uuid),
            "album_url": reverse("music:album_detail", kwargs={"uuid": album.uuid}),
            "artist_url": reverse("music:artist_detail", kwargs={"uuid": album.artist.uuid}),
            "artwork_url": f"{settings.IMAGES_URL}album_artwork/{album.uuid}",
            "year": album.year,
            "track_count": album._track_count or 0,  # type: ignore[attr-defined]
        }
        for album in queryset
    ]


def scan_zipfile(zipfile_obj: bytes, include_song_data: bool = False) -> dict[str, Any]:
    """Scan a ZIP file containing MP3 files and extract metadata.

    Args:
        zipfile_obj: ZIP file content as bytes.
        include_song_data: Whether to include the actual song data in the result.

    Returns:
        Dictionary containing album, artist, and song information from the ZIP file.
    """
    song_info = []
    artist = set()
    album = None

    with zipfile.ZipFile(BytesIO(zipfile_obj), mode="r") as archive:
        for file in archive.infolist():
            if file.filename.lower().endswith("mp3"):
                with archive.open(file.filename) as myfile:
                    song_data = myfile.read()
                    id3_info = get_id3_info(song_data)
                    if include_song_data:
                        id3_info["data"] = song_data
                    song_info.append(id3_info)
                    artist.add(id3_info["artist"])
                    album = id3_info["album_name"]

    return {
        "album": album,
        "artist": list(artist),
        "song_info": song_info,
    }


def create_album_from_zipfile(
    zipfile_obj: bytes,
    artist_name: str,
    song_source: "SongSource",
    tags: str | None,
    user: User,
    changes: dict[str, dict[str, Any]]
) -> Iterator[dict[str, Any]]:
    """Create an album from a ZIP file, streaming progress per track.

    Args:
        zipfile_obj: ZIP file content as bytes.
        artist_name: Name of the artist.
        song_source: The source where the songs came from.
        tags: Comma-separated string of tags to apply to songs.
        user: The user creating the album.
        changes: Dictionary of changes to apply to specific tracks.

    Yields:
        ``{"type": "start", "total": N}`` once after the zip has been
        scanned and validated, then ``{"type": "progress", "current": i,
        "total": N, "title": str}`` after each song is saved and uploaded
        to S3, and finally ``{"type": "done", "album_uuid": str}``.

    Raises:
        ValueError: If the zip contains no MP3 files. Raised before the
            first yield, so callers can convert this to a pre-stream 400.
    """
    info = scan_zipfile(zipfile_obj, include_song_data=True)

    if not info["song_info"]:
        raise ValueError("ZIP file contains no MP3 files")

    total = len(info["song_info"])
    yield {"type": "start", "total": total}

    with transaction.atomic():
        artist, _ = Artist.objects.get_or_create(name=artist_name, user=user)

        album = Song.get_or_create_album(
            user,
            {
                "album_name": info["song_info"][0]["album_name"],
                "artist": artist,
                "compilation": False,
                "year": info["song_info"][0]["year"],
            }
        )

        for index, song_info in enumerate(info["song_info"], start=1):
            song = Song(
                artist=artist,
                album=album,
                length=song_info["length"],
                source=song_source,
                title=song_info["title"],
                track=song_info["track"],
                user=user,
                year=song_info["year"],
            )
            # Edit the title and add a note if the user made any changes
            change = (changes or {}).get(str(song_info.get("track")), {})
            note = change.get("note")
            if note:
                song.note = note
            title_edited = change.get("title")
            if title_edited:
                song.title = title_edited
            song.save()

            if tags:
                tag_objs = [
                    Tag.objects.get_or_create(name=t.strip(), user=user)[0]
                    for t in tags.split(",") if t.strip()
                ]
                song.tags.set(tag_objs)

            # Upload the song and its artwork to S3
            song.upload_song_media_to_s3(song_info["data"])

            yield {
                "type": "progress",
                "current": index,
                "total": total,
                "title": song.title,
            }

    if album is None:
        raise ValueError("Album creation failed unexpectedly")
    yield {"type": "done", "album_uuid": str(album.uuid)}


def get_id3_info(song: bytes) -> dict[str, Any]:
    """Read a song's ID3 information.

    Args:
        song: Song data as bytes.

    Returns:
        Dictionary containing the song's metadata.
    """
    info = MP3(fileobj=BytesIO(song), ID3=EasyID3)

    data: dict[str, Any] = {
        "filesize": humanize.naturalsize(len(song)),
        "bit_rate": info.info.bitrate,
        "sample_rate": info.info.sample_rate,
        "album_name": None,
        "year": None,
        "track": None,
        "genre": None,
    }

    for field in ("artist", "title"):
        data[field] = info[field][0] if info.get(field) else None
    if info.get("date"):
        data["year"] = info["date"][0]
    if info.get("album"):
        data["album_name"] = info["album"][0]
    # Genre is part of the EasyID3 default key map, but only some files set
    # it. Surface it so the create page can offer it as a one-click tag.
    if info.get("genre"):
        data["genre"] = info["genre"][0]
    data["length"] = int(info.info.length)
    data["length_pretty"] = convert_seconds(info.info.length)

    if info.get("tracknumber"):
        track_info = info["tracknumber"][0].split("/")
        track_number = track_info[0]
        data["track"] = track_number

    return data


# ---------------------------------------------------------------------------
# AWS service functions
# ---------------------------------------------------------------------------

def delete_song_from_s3(uuid: str) -> None:
    """Delete a song file from the music S3 bucket.

    Args:
        uuid: The song's UUID string.
    """
    s3_delete_object(settings.AWS_BUCKET_NAME_MUSIC, f"songs/{uuid}")


def upload_song_to_s3(
    uuid: str,
    fileobj: Any,
    artist: str,
    title: str,
) -> None:
    """Upload a song file to S3 with artist/title metadata.

    Args:
        uuid: The song's UUID string.
        fileobj: A file-like object containing the MP3 data.
        artist: The artist name to store as S3 metadata.
        title: The song title to store as S3 metadata.
    """
    s3_upload_fileobj(
        fileobj,
        settings.AWS_BUCKET_NAME_MUSIC,
        f"songs/{uuid}",
        metadata={"artist": artist, "title": title},
    )


def upload_album_artwork(uuid: str, fileobj: Any, content_type: str) -> None:
    """Upload album cover artwork to S3.

    Args:
        uuid: The album's UUID string.
        fileobj: A file-like object containing the image data.
        content_type: MIME type of the image (e.g. ``"image/jpeg"``).
    """
    s3_upload_fileobj(
        fileobj,
        settings.AWS_BUCKET_NAME_MUSIC,
        f"album_artwork/{uuid}",
        content_type=content_type,
    )


def upload_artist_image(uuid: str, fileobj: Any) -> None:
    """Upload an artist image to S3.

    Args:
        uuid: The artist's UUID string.
        fileobj: A file-like object containing the JPEG image data.
    """
    s3_upload_fileobj(
        fileobj,
        settings.AWS_BUCKET_NAME_MUSIC,
        f"artist_images/{uuid}",
        content_type="image/jpeg",
    )


def list_artist_image_keys(prefix: str = "artist_images/") -> set[str]:
    """Return a set of S3 keys under the artist_images prefix.

    Args:
        prefix: The S3 key prefix to list. Defaults to ``"artist_images/"``.

    Returns:
        Set of S3 object key strings.
    """
    return set(s3_list_objects(settings.AWS_BUCKET_NAME_MUSIC, prefix))


def get_dashboard_stats(user: User) -> dict[str, Any]:
    """Aggregate dashboard stats: weekly plays, top tag, monthly adds, streak.

    Returns a dict with keys: plays_this_week, top_tag_7d, added_this_month,
    longest_streak, plays_today.
    """
    today = timezone.localdate()
    week_ago = timezone.now() - timedelta(days=7)
    local_now = timezone.localtime()
    month_start = local_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    listens = Listen.objects.filter(user=user)

    plays_this_week = listens.filter(created__gte=week_ago).count()
    plays_today = listens.filter(created__date=today).count()
    added_this_month = Album.objects.filter(
        user=user, created__gte=month_start
    ).count()

    top_tag_qs = (
        Tag.objects.filter(song__listen__in=listens.filter(created__gte=week_ago))
        .annotate(count=Count("song__listen"))
        .order_by("-count")
        .values("name", "count")
        .first()
    )
    top_tag_7d = (
        {"name": top_tag_qs["name"], "count": top_tag_qs["count"]}
        if top_tag_qs
        else None
    )

    listen_dates = sorted(
        {
            row["d"]
            for row in listens.annotate(d=TruncDate("created")).values("d").distinct()
        }
    )
    longest_streak = 0
    if listen_dates:
        run = 1
        longest_streak = 1
        for prev, curr in zip(listen_dates, listen_dates[1:]):
            if (curr - prev).days == 1:
                run += 1
                longest_streak = max(longest_streak, run)
            else:
                run = 1

    return {
        "plays_this_week": plays_this_week,
        "top_tag_7d": top_tag_7d,
        "added_this_month": added_this_month,
        "longest_streak": longest_streak,
        "plays_today": plays_today,
    }


def _build_music_search_query(
    user_id: int, q: str, doctype: str, *, size: int, offset: int = 0
) -> dict[str, Any]:
    """Construct an ES query for songs or albums matching ``q``."""
    from search.services import build_base_query

    search_object = build_base_query(
        user_id,
        size=size,
        offset=offset,
        source_fields=["uuid", "doctype"],
        additional_must=[
            {"term": {"doctype": doctype}},
            {
                "multi_match": {
                    "query": q,
                    "type": "bool_prefix",
                    "fields": ["title^3", "artist^2", "album", "tags"],
                }
            },
        ],
    )
    search_object["sort"] = [{"_score": {"order": "desc"}}]
    return search_object


def search_library(
    user: User,
    q: str,
    *,
    song_limit: int = 8,
    album_limit: int = 8,
    song_offset: int = 0,
) -> dict[str, Any]:
    """Search the user's songs and albums in Elasticsearch, hydrate from DB.

    Returns a dict with keys ``songs``, ``albums`` (lists of result dicts),
    and ``totals`` (per-kind match counts).
    """
    from search.services import execute_search

    q = (q or "").strip()
    if not q:
        return {
            "songs": [],
            "albums": [],
            "totals": {"songs": 0, "albums": 0},
        }

    user_id = cast(int, user.id)

    # --- songs ---
    song_query = _build_music_search_query(
        user_id, q, "song", size=song_limit, offset=song_offset
    )
    song_response = execute_search(song_query)
    song_hits = song_response["hits"]["hits"]
    song_total = song_response["hits"]["total"]["value"]
    song_uuids = [h["_source"]["uuid"] for h in song_hits]

    song_map = {
        str(s.uuid): s
        for s in Song.objects.filter(user=user, uuid__in=song_uuids).select_related(
            "artist", "album"
        )
    }
    songs: list[dict[str, Any]] = []
    for uuid in song_uuids:
        s = song_map.get(uuid)
        if s is None:
            continue
        songs.append(
            {
                "uuid": str(s.uuid),
                "title": s.title,
                "artist": s.artist.name,
                "artist_url": reverse(
                    "music:artist_detail", kwargs={"uuid": s.artist.uuid}
                ),
                "year": s.year,
                "length": convert_seconds(s.length),
                "album_title": s.album.title if s.album else None,
                "album_uuid": str(s.album.uuid) if s.album else None,
            }
        )

    # --- albums ---
    album_query = _build_music_search_query(
        user_id, q, "album", size=album_limit
    )
    album_response = execute_search(album_query)
    album_hits = album_response["hits"]["hits"]
    album_total = album_response["hits"]["total"]["value"]
    album_uuids = [h["_source"]["uuid"] for h in album_hits]

    album_map = {
        str(a.uuid): a
        for a in Album.objects.filter(user=user, uuid__in=album_uuids).select_related(
            "artist"
        )
    }
    albums: list[dict[str, Any]] = []
    for uuid in album_uuids:
        a = album_map.get(uuid)
        if a is None:
            continue
        albums.append(
            {
                "uuid": str(a.uuid),
                "title": a.title,
                "artist_name": a.artist.name,
                "artist_uuid": str(a.artist.uuid),
                "year": a.year,
                "artwork_url": f"{settings.IMAGES_URL}album_artwork/{a.uuid}",
                "album_url": reverse("music:album_detail", kwargs={"uuid": a.uuid}),
            }
        )

    return {
        "songs": songs,
        "albums": albums,
        "totals": {"songs": song_total, "albums": album_total},
    }


def get_library_counts(user: User) -> dict[str, int]:
    """Total counts for the user's music library: albums, songs, artists, tags.

    The tag count is the number of distinct user-owned tags attached to at
    least one of the user's songs or albums.
    """
    albums = Album.objects.filter(user=user).count()
    songs = Song.objects.filter(user=user).count()
    artists = Artist.objects.filter(user=user).count()
    tags = (
        Tag.objects.filter(user=user)
        .filter(Q(song__user=user) | Q(album__user=user))
        .distinct()
        .count()
    )
    return {
        "albums": albums,
        "songs": songs,
        "artists": artists,
        "tags": tags,
    }
