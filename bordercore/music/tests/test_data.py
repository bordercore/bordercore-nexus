"""
Song Data Integrity Tests

This module contains integration tests that verify data consistency across multiple
storage systems for song records. These tests ensure that song data remains synchronized
between the database, S3 object storage, Elasticsearch index, and local filesystem.
"""

import re
from pathlib import Path

import boto3
import pytest

import django
from django.conf import settings

from lib.util import get_elasticsearch_connection, get_missing_blob_ids
from music.models import Song

pytestmark = pytest.mark.data_quality

django.setup()

bucket_name = settings.AWS_BUCKET_NAME_MUSIC
s3_client = boto3.client("s3")


@pytest.fixture()
def es():
    "Elasticsearch fixture"
    yield get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)


def get_s3_song_uuids():
    """
    Get all song UUIDs from S3 by listing objects with "songs/" prefix.

    Returns:
        list: List of song UUIDs found in S3
    """
    paginator = s3_client.get_paginator("list_objects_v2")
    s3_uuids = []

    for page in paginator.paginate(Bucket=bucket_name, Prefix="songs/"):
        if "Contents" in page:
            for obj in page["Contents"]:
                key = obj["Key"]
                if key.startswith("songs/") and len(key) > 6:
                    uuid = key[6:]  # Remove "songs/" prefix
                    if uuid:  # Only add non-empty UUIDs
                        s3_uuids.append(uuid)

    return s3_uuids


def test_album_songs_have_length_field():
    "Assert that all album songs have a length field"
    s = Song.objects.filter(length__isnull=True)
    assert len(s) == 0, f"{len(s)} songs have no length field"


def test_all_songs_exist_in_s3():
    "Assert that all songs in the database exist in S3"
    songs = Song.objects.all().only("uuid")
    db_uuids = [str(song.uuid) for song in songs]

    # Get all objects with the songs/ prefix in one call
    paginator = s3_client.get_paginator("list_objects_v2")
    s3_uuids = set()

    for page in paginator.paginate(Bucket=bucket_name, Prefix="songs/"):
        if "Contents" in page:
            s3_uuids.update(obj["Key"] for obj in page["Contents"])

    # Check which songs are missing
    missing_from_s3 = []
    for uuid in db_uuids:
        expected_key = f"songs/{uuid}"
        if expected_key not in s3_uuids:
            missing_from_s3.append(uuid)

    assert not missing_from_s3, f"Songs found in the database but not in S3: {missing_from_s3}"


def test_songs_in_db_exist_in_elasticsearch(es):
    "Assert that all songs in the database exist in Elasticsearch"
    songs = Song.objects.all().only("uuid")
    step_size = 100
    song_count = songs.count()

    for batch in range(0, song_count, step_size):

        # The batch_size will always be equal to "step_size", except probably
        #  the last batch, which will be less.
        batch_size = step_size if song_count - batch > step_size else song_count - batch

        query = [
            {
                "term": {
                    "_id": str(x.uuid)
                }
            }
            for x
            in songs[batch:batch + step_size]
        ]

        search_object = {
            "query": {
                "bool": {
                    "should": query
                }
            },
            "size": batch_size,
            "_source": [""]
        }

        found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)

        assert found["hits"]["total"]["value"] == batch_size,\
            "Songs found in the database but not in Elasticsearch: " + ", ".join(sorted(get_missing_blob_ids(songs[batch:batch + step_size], found)))


def test_songs_in_s3_exist_in_db():
    """Assert that all songs in S3 also exist in the database"""
    # Get all song UUIDs from database in one query
    songs = Song.objects.all().only("uuid")
    db_uuids = {str(song.uuid) for song in songs}

    # Get all song UUIDs from S3
    s3_uuids = set(get_s3_song_uuids())

    # Check which S3 songs are missing from database
    missing_from_db = []
    for uuid in s3_uuids:
        if uuid not in db_uuids:
            missing_from_db.append(uuid)

    assert not missing_from_db, f"Songs found in S3 but not in the database: {missing_from_db}"


def test_elasticsearch_songs_exist_in_s3(es):
    """Assert that all songs in Elasticsearch exist in S3"""
    # Get all song UUIDs from Elasticsearch in one query
    search_object = {
        "query": {
            "bool": {
                "must": [
                    {
                        "term": {
                            "doctype": "song"
                        }
                    }
                ]
            }
        },
        "from_": 0, "size": 10000,
        "_source": ["uuid"]
    }
    songs_in_elasticsearch = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]["hits"]
    es_uuids = [song["_source"]["uuid"] for song in songs_in_elasticsearch]

    # Get all song UUIDs from S3
    s3_uuids = set(get_s3_song_uuids())

    # Check which Elasticsearch songs are missing from S3
    missing_from_s3 = []
    for uuid in es_uuids:
        if uuid not in s3_uuids:
            missing_from_s3.append(uuid)

    assert not missing_from_s3, f"Songs found in Elasticsearch but not in S3: {missing_from_s3}"


@pytest.mark.wumpus
def test_song_in_s3_exist_on_filesystem():
    """Assert that all songs in S3 also exist on the filesystem"""
    def sanitize_filename(name):
        return name.replace("/", "-")

    def get_song_path(song):
        """Generate filesystem path for a song"""
        first_letter_dir = re.sub(r"\W+", "", song.artist.name).lower()[0]

        if song.album:
            track_number = f"{song.track:02d}"  # Zero-pad to 2 digits
            base_path = "/home/media/music"

            if song.album.compilation:
                return f"{base_path}/v/Various/{song.album.title}/{track_number} - {song.title}.mp3"
            artist_name = sanitize_filename(song.artist.name)
            album_title = sanitize_filename(song.album.title)
            song_title = sanitize_filename(song.title)
            return f"{base_path}/{first_letter_dir}/{artist_name}/{album_title}/{track_number} - {song_title}.mp3"
        artist_name = sanitize_filename(song.artist.name)
        song_title = sanitize_filename(song.title)
        return f"/home/media/music/{first_letter_dir}/{artist_name}/{song_title}.mp3"

    # Get all songs from database with related data
    songs = Song.objects.all().select_related("artist", "album")
    song_cache = {str(song.uuid): song for song in songs}

    # Get all song UUIDs from S3
    s3_uuids = set(get_s3_song_uuids())

    # Check filesystem existence for all S3 songs
    missing_from_filesystem = []
    for uuid in s3_uuids:
        if uuid in song_cache:
            song = song_cache[uuid]
            path = get_song_path(song)
            if not Path(path).is_file():
                missing_from_filesystem.append(f"{song} - UUID: {uuid} - Path: {path}")

    assert not missing_from_filesystem, f"Songs found in S3 but not on filesystem: {missing_from_filesystem}"
