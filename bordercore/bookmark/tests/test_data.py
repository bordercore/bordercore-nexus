"""
Bookmark Data Integrity Tests

This module contains integration tests that verify data consistency across multiple
storage systems for bookmark records. These tests ensure that bookmark data remains synchronized between the database, S3 object storage, Elasticsearch index, and local filesystem.
"""

import re

import boto3
import pytest

import django
from django.conf import settings
from django.db.models import Q

from bookmark.models import Bookmark
from lib.util import get_elasticsearch_connection, get_missing_bookmark_ids

pytestmark = pytest.mark.data_quality

django.setup()

bucket_name = settings.AWS_STORAGE_BUCKET_NAME


@pytest.fixture()
def es():
    "Elasticsearch fixture"
    yield get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)


def test_bookmarks_in_db_exist_in_elasticsearch(es):
    """Test that all bookmarks in the database are present in Elasticsearch.

    This test retrieves all bookmark UUIDs from the database in batches and
    checks whether each batch exists in the configured Elasticsearch index.

    Args:
        es: Elasticsearch client fixture for querying the search index.

    Raises:
        AssertionError: If one or more bookmarks exist in the database but
            are missing from the Elasticsearch index.
    """
    bookmarks = Bookmark.objects.all().only("uuid")

    step = 50
    for batch in range(0, len(bookmarks), step):
        batch_size = len(bookmarks[batch:batch + step])

        query = [
            {
                "term": {
                    "uuid": str(b.uuid)
                }
            }
            for b
            in bookmarks[batch:batch + step]
        ]

        search_object = {
            "query": {
                "bool": {
                    "should": query
                }
            },
            "size": batch_size,
            "_source": ["uuid"]
        }

        found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)
        if found["hits"]["total"]["value"] != batch_size:
            missing_uuids = get_missing_bookmark_ids(bookmarks[batch:batch + step], found)
            uuid_list = "\nuuid:".join(x for x in missing_uuids)
            assert False, f"bookmarks found in the database but not in Elasticsearch, uuid:{uuid_list}"


def test_bookmark_tags_match_elasticsearch(es):
    """Test that all bookmark tags match those found in Elasticsearch.

    This test validates data consistency between the database and Elasticsearch
    by comparing bookmark tags.

    Args:
        es: Elasticsearch client fixture for querying the search index.

    Raises:
        AssertionError: If any bookmark's tags don't match between the database
            and Elasticsearch. The error message includes missing bookmark IDs.
    """

    bookmarks = (
        Bookmark.objects
        .filter(tags__isnull=False)
        .prefetch_related("tags")
        .only("uuid")
        .order_by("uuid")
        .distinct("uuid")
    )

    # Convert to list once to avoid re-evaluation
    bookmarks_list = list(bookmarks)

    # Process in batches for better performance
    step = 200

    for batch_start in range(0, len(bookmarks_list), step):
        batch_bookmarks = bookmarks_list[batch_start:batch_start + step]

        should_queries = []
        bookmarks_with_tags = []  # Track which bookmarks actually have tags

        for bookmark in batch_bookmarks:
            tag_names = [tag.name for tag in bookmark.tags.all()]

            if tag_names:
                bookmarks_with_tags.append(bookmark)
                bookmark_query = {
                    "bool": {
                        "must": [
                            {
                                "term": {
                                    "uuid": str(bookmark.uuid)
                                }
                            },
                            {
                                "bool": {
                                    "must": [
                                        {
                                            "term": {
                                                "tags.keyword": tag_name
                                            }
                                        }
                                        for tag_name in tag_names
                                    ]
                                }
                            }
                        ]
                    }
                }
                should_queries.append(bookmark_query)

        if not should_queries:
            continue

        search_object = {
            "query": {
                "bool": {
                    "should": should_queries,
                }
            },
            "size": len(should_queries),
            "_source": ["uuid"],
        }

        found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)
        expected_count = len(should_queries)
        actual_count = found["hits"]["total"]["value"]

        assert actual_count == expected_count, \
            f"Bookmark's tags don't match those found in Elasticsearch: {get_missing_bookmark_ids(bookmarks_with_tags, found)}"


def test_elasticsearch_bookmarks_exist_in_db(es):
    """Test that all bookmarks in Elasticsearch exist in the database.

    This test performs a bulk validation to ensure data consistency between
    Elasticsearch and the database by fetching all bookmark-type documents from
    Elasticsearch and verifying each UUID exists in the Bookmark model.

    Args:
        es: Elasticsearch client fixture for querying the search index.

    Raises:
        AssertionError: If any bookmark IDs found in Elasticsearch are missing
            from the database.
    """
    search_object = {
        "query": {
            "term": {
                "doctype": "bookmark"
            }
        },
        "from_": 0,
        "size": 10000,
        "_source": ["uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]["hits"]

    if not found:
        return

    # Extract ES UUIDs
    es_uuids = [bookmark["_source"]["uuid"] for bookmark in found]

    # Single database query to get all existing UUIDs
    existing_uuids = set(
        str(uuid) for uuid in Bookmark.objects.filter(uuid__in=es_uuids)
        .values_list("uuid", flat=True)
    )

    # Find missing UUIDs
    missing_from_db = [uuid for uuid in es_uuids if uuid not in existing_uuids]

    if missing_from_db:
        assert False, f"Bookmarks found in Elasticsearch but not in database: {missing_from_db}"


def test_bookmark_fields_are_trimmed():
    """Test that bookmark fields do not contain leading or trailing whitespace.

    This test queries the ``Bookmark`` model for any records where the
    ``url``, ``name``, or ``note`` fields start or end with whitespace
    characters.

    Raises:
        AssertionError: If one or more bookmarks contain leading or
            trailing whitespace in any of the tested fields.
    """
    bookmarks = Bookmark.objects.filter(
        Q(url__iregex=r"\s$")
        | Q(url__iregex=r"^\s")
        | Q(name__iregex=r"\s$")
        | Q(name__iregex=r"^\s")
        | Q(note__iregex=r"\s$")
        | Q(note__iregex=r"^\s")
    )
    assert len(bookmarks) == 0, f"{len(bookmarks)} fail this test; example: id={bookmarks[0].id}"


def test_bookmark_thumbnails_in_s3_exist_in_db():
    """Test that all bookmark thumbnails in S3 also exist in the database.

    This test validates data consistency between S3 storage and the database
    by extracting bookmark UUIDs from S3 object keys and verifying each UUID
    exists in the Bookmark model using a single bulk database query.

    Raises:
        AssertionError: If any bookmark UUIDs found in S3 are missing from the
            database. The error message includes the list of missing UUIDs.
    """
    s3_resource = boto3.resource("s3")
    unique_uuids = set()

    # Compile regex once for better performance
    uuid_pattern = re.compile(r"^bookmarks/(\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b)")

    # Extract all UUIDs from S3
    paginator = s3_resource.meta.client.get_paginator("list_objects_v2")
    page_iterator = paginator.paginate(Bucket=bucket_name)

    for page in page_iterator:
        if "Contents" not in page:
            continue

        for obj in page["Contents"]:
            match = uuid_pattern.search(obj["Key"])
            if match:
                unique_uuids.add(match.group(1))

    if not unique_uuids:
        return

    existing_uuids = set(
        str(uuid) for uuid in Bookmark.objects.filter(uuid__in=unique_uuids)
        .values_list("uuid", flat=True)
    )

    # Find missing UUIDs
    missing_from_db = unique_uuids - existing_uuids

    if missing_from_db:
        assert False, f"Bookmark thumbnails found in S3 but not in DB: {missing_from_db}"
