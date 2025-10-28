"""
Blob Data Integrity Tests

This module contains integration tests that verify data consistency across multiple
storage systems for blob records. These tests ensure that blob data remains synchronized between the database, S3 object storage, Elasticsearch index, and local filesystem.
"""

import logging
import re
from collections import defaultdict
from os import stat
from pathlib import Path
from pwd import getpwuid

import boto3
import pytest

import django
from django.conf import settings
from django.db.models import Q

from lib.util import (get_elasticsearch_connection, get_missing_blob_ids,
                      is_image)

logging.getLogger("elasticsearch").setLevel(logging.ERROR)

pytestmark = pytest.mark.data_quality

django.setup()

from blob.models import Blob, ILLEGAL_FILENAMES, MetaData   # isort:skip
from drill.models import Question  # isort:skip
from tag.models import Tag  # isort:skip


BLOB_DIR = "/home/media"
ELASTICSEARCH_TIMEOUT = 30

bucket_name = settings.AWS_STORAGE_BUCKET_NAME

@pytest.fixture()
def es():
    "Elasticsearch fixture"
    yield get_elasticsearch_connection(
        host=settings.ELASTICSEARCH_ENDPOINT,
        timeout=ELASTICSEARCH_TIMEOUT
    )


def test_books_with_tags(es):
    "Assert that all books have at least one tag"
    search_object = {
        "query": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "must_not": [
                                {
                                    "exists": {
                                        "field": "tags"
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "term": {
                            "doctype": "book"
                        }
                    }
                ]
            }
        },
        "from_": 0, "size": 10000,
        "_source": ["uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)['hits']

    assert found['total']['value'] == 0, f"{found['total']['value']} books found without tags, uuid={found['hits'][0]['_id']}"


def test_documents_and_notes_with_dates(es):
    "Assert that all documents and notes have a date"
    search_object = {
        "query": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "must_not": [
                                {
                                    "exists": {
                                        "field": "date_unixtime"
                                    }
                                },
                                {
                                    "exists": {
                                        "field": "date"
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "bool": {
                            "should": [
                                {
                                    "term": {
                                        "doctype": "document"
                                    }
                                },
                                {
                                    "term": {
                                        "doctype": "note"
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        },
        "from_": 0, "size": 10000,
        "_source": ["uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]

    assert found["total"]["value"] == 0, f"{found['total']['value']} documents or notes have no date, uuid={found['hits'][0]['_id']}"


def test_videos_with_durations(es):
    "Assert that all videos have a duration"
    search_object = {
        "query": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "must_not": [
                                {
                                    "exists": {
                                        "field": "duration"
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "wildcard": {
                            "content_type": "**video**"
                        }
                    }
                ]
            }
        },
        "from_": 0, "size": 10000,
        "_source": ["uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]

    assert found["total"]["value"] == 0, f"{found['total']['value']} videos found with no duration, uuid={found['hits'][0]['_id']}"


def test_dates_with_unixtimes(es):
    "Assert that all documents with dates also have a date_unixtime field"
    search_object = {
        "query": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "must_not": [
                                {
                                    "exists": {
                                        "field": "date_unixtime"
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "bool": {
                            "must": [
                                {
                                    "exists": {
                                        "field": "date"
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "term": {
                            "doctype": "blob"
                        }
                    }
                ]
            }
        },
        "from_": 0, "size": 10000,
        "_source": ["uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]["total"]["value"]
    assert found == 0, f"{found} documents fail this test"


def test_books_with_names(es):
    "Assert that all books have a name"
    search_object = {
        "query": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "must_not": [
                                {
                                    "exists": {
                                        "field": "name"
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "term": {
                            "doctype": "book"
                        }
                    }
                ]
            }
        },
        "from_": 0, "size": 10000,
        "_source": ["uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]["total"]["value"]

    assert found == 0, f"{found} books found with no name"


def test_books_with_author(es):
    "Assert that all books have at least one author or editor"
    search_object = {
        "query": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "must_not": [
                                {
                                    "exists": {
                                        "field": "metadata.author"
                                    }
                                },
                                {
                                    "exists": {
                                        "field": "metadata.editor"
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "term": {
                            "doctype": "book"
                        }
                    }
                ]
            }
        },
        "from_": 0, "size": 10000,
        "_source": ["uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]
    assert found["total"]["value"] == 0, f"{found['total']['value']} books found with no author, uuid={found['hits'][0]['_id']}"


def test_books_with_contents(es):
    "Assert that all books have contents"
    blobs_not_indexed = [str(x.uuid) for x in Blob.objects.filter(is_indexed=False).only("uuid")]
    search_object = {
        "query": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "must_not": [
                                {
                                    "exists": {
                                        "field": "attachment"
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "term": {
                            "doctype": "book"
                        }
                    }
                ]
            }
        },
        "from_": 0, "size": 10000,
        "_source": ["filename", "uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]

    for match in found["hits"]:
        if match["_source"]["filename"].endswith("pdf") and match["_id"] not in blobs_not_indexed:
            assert False, f"Book has no content, uuid={match['_id']}"


def test_tags_all_lowercase():
    "Assert that all tags are lowercase"
    t = Tag.objects.filter(name__regex=r"[[:upper:]]+")
    assert len(t) == 0, f"{len(t)} tags are not lowercase, tag={t[0]}"


def test_blobs_in_db_exist_in_elasticsearch(es):
    """Assert that all blobs in the database exist in Elasticsearch"""
    blob_uuids = list(
        Blob.objects.filter(is_indexed=True)
        .values_list("uuid", flat=True)
        .iterator(chunk_size=1000)  # Use iterator for memory efficiency
    )

    if not blob_uuids:
        return

    step_size = 500
    total_count = len(blob_uuids)

    for batch_start in range(0, total_count, step_size):
        batch_end = min(batch_start + step_size, total_count)
        batch_uuids = blob_uuids[batch_start:batch_end]
        batch_size = len(batch_uuids)

        search_object = {
            "query": {
                "terms": {
                    "_id": [str(uuid) for uuid in batch_uuids]
                }
            },
            "size": batch_size,
            "_source": False,
            "track_total_hits": True  # Ensure accurate total count
        }

        found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)
        found_count = found["hits"]["total"]["value"]

        assert found_count == batch_size, (
            f"Expected {batch_size} blobs in Elasticsearch, found {found_count}. "
            f"Missing blobs: {get_missing_blob_ids_optimized(batch_uuids, found)}"
        )


def get_missing_blob_ids_optimized(expected_uuids, es_response):
    """Helper function to identify missing blob IDs efficiently"""
    found_ids = {hit["_id"] for hit in es_response["hits"]["hits"]}
    expected_ids = {str(uuid) for uuid in expected_uuids}
    missing_ids = expected_ids - found_ids
    return list(missing_ids)


def test_blobs_in_s3_exist_in_db():
    """Assert that all blobs in S3 also exist in the database - Optimized Version"""
    s3_resource = boto3.resource("s3")

    # Step 1: Extract all UUIDs from S3
    s3_uuids = set()
    paginator = s3_resource.meta.client.get_paginator("list_objects_v2")
    page_iterator = paginator.paginate(Bucket=bucket_name)

    # Compile regex once for better performance
    uuid_pattern = re.compile(r"^blobs/(.*?)/")

    for page in page_iterator:
        if "Contents" not in page:
            continue

        for obj in page["Contents"]:
            match = uuid_pattern.search(obj["Key"])
            if match:
                s3_uuids.add(match.group(1))

    if not s3_uuids:
        return

    batch_size = 1000
    missing_uuids = []

    s3_uuid_list = list(s3_uuids)
    for i in range(0, len(s3_uuid_list), batch_size):
        batch_uuids = s3_uuid_list[i:i + batch_size]

        # Single query to check which UUIDs exist in this batch
        existing_uuids = set(
            str(uuid) for uuid in Blob.objects.filter(uuid__in=batch_uuids)
            .values_list("uuid", flat=True)
        )

        # Find missing UUIDs in this batch
        batch_missing = [uuid for uuid in batch_uuids if uuid not in existing_uuids]
        missing_uuids.extend(batch_missing)

    if missing_uuids:
        raise AssertionError(
            f"Found {len(missing_uuids)} blobs in S3 but not in database: "
            f"{missing_uuids[:10]}{'...' if len(missing_uuids) > 10 else ''}"
        )


def test_images_have_thumbnails():
    """Assert that every image blob has a thumbnail - Optimized Version"""
    s3_client = boto3.client("s3")

    # Step 1: Get all image blobs at once
    image_blobs = []
    for blob in Blob.objects.filter(~Q(file="")).select_related().iterator(chunk_size=1000):
        if is_image(blob.file):
            image_blobs.append(blob)

    if not image_blobs:
        return

    # Step 2: Build all expected thumbnail keys
    expected_thumbnails = {}
    for blob in image_blobs:
        key = f"{settings.MEDIA_ROOT}/{blob.uuid}/cover.jpg"
        expected_thumbnails[key] = blob.uuid

    # Step 3: Use S3 list_objects_v2 to check existence in batches
    existing_keys = set()
    paginator = s3_client.get_paginator("list_objects_v2")

    # List all objects with the MEDIA_ROOT prefix
    page_iterator = paginator.paginate(
        Bucket=bucket_name,
        Prefix=f"{settings.MEDIA_ROOT}/"
    )

    for page in page_iterator:
        if "Contents" not in page:
            continue

        for obj in page["Contents"]:
            key = obj["Key"]
            if key in expected_thumbnails:
                existing_keys.add(key)

    # Step 4: Find missing thumbnails
    missing_thumbnails = []
    for expected_key, blob_uuid in expected_thumbnails.items():
        if expected_key not in existing_keys:
            missing_thumbnails.append(blob_uuid)

    if missing_thumbnails:
        assert False, (
            f"Found {len(missing_thumbnails)} image blobs without thumbnails: "
            f"{missing_thumbnails[:10]}{'...' if len(missing_thumbnails) > 10 else ''}"
        )


def test_elasticsearch_blobs_exist_in_s3(es):
    "Assert that all blobs in Elasticsearch exist in S3"

    search_object = {
        "query": {
            "bool": {
                "must":
                {
                    "exists": {
                        "field": "sha1sum"
                    }
                },
                "must_not":
                {
                    "term": {
                        "sha1sum": ""
                    }
                }
            }
        },
        "from_": 0, "size": 10000,
        "_source": ["filename", "sha1sum", "uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]["hits"]

    s3_resource = boto3.resource("s3")

    unique_uuids = {}

    paginator = s3_resource.meta.client.get_paginator("list_objects_v2")
    page_iterator = paginator.paginate(Bucket=bucket_name)

    for page in page_iterator:
        for key in page["Contents"]:
            m = re.search(r"^blobs/(.*?)/", str(key["Key"]))
            if m:
                unique_uuids[m.group(1)] = True

    for blob in found:
        if not blob["_source"]["uuid"] in unique_uuids:
            assert False, f"blob {blob['_source']['uuid']} exists in Elasticsearch but not in S3"

@pytest.mark.wumpus
def test_blobs_in_s3_exist_on_filesystem():
    "Assert that all blobs in S3 exist on the filesystem"

    s3_resource = boto3.resource("s3")

    paginator = s3_resource.meta.client.get_paginator("list_objects_v2")
    page_iterator = paginator.paginate(Bucket=bucket_name)

    for page in page_iterator:
        for key in page["Contents"]:
            m = re.search(r"^blobs/.*?/(.+)", str(key["Key"]))
            if m:
                file_path = f"{BLOB_DIR}/{key['Key']}"
                filename = m.group(1)
                if not Path(file_path).exists() and filename not in ILLEGAL_FILENAMES:
                    assert False, f"blob {key['Key']} exists in S3 but not on the filesystem"


@pytest.mark.wumpus
def test_blobs_on_filesystem_exist_in_s3():
    "Assert that all blobs on the filesystem exist in S3"

    s3_resource = boto3.resource("s3")

    paginator = s3_resource.meta.client.get_paginator("list_objects_v2")
    page_iterator = paginator.paginate(Bucket=bucket_name)

    blobs = {}

    # Create a hash of all blobs in S3 for later lookup
    for page in page_iterator:
        for key in page["Contents"]:
            m = re.search(r"^blobs/.*?/.+", str(key["Key"]))
            if m:
                file_path = f"{BLOB_DIR}/{key['Key']}"
                blobs[file_path] = True

    for x in Path(f"{BLOB_DIR}/blobs").rglob("*"):
        if x.is_file() and blobs.get(str(x), None) is None and x.name not in ILLEGAL_FILENAMES:
            assert False, f"{x} found on the filesystem but not in S3"


def test_elasticsearch_blobs_exist_in_db(es):
    """Assert that all blobs in Elasticsearch exist in the database - Optimized Version"""

    search_object = {
        "query": {
            "terms": {
                "doctype": ["book", "blob", "document"]
            }
        },
        "size": 10000,
        "_source": ["uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]["hits"]

    if not found:
        return

    # Extract all UUIDs from ES
    es_uuids = [blob["_source"]["uuid"] for blob in found]

    # Single database query to get all existing UUIDs
    existing_uuids = set(
        str(uuid) for uuid in Blob.objects.filter(uuid__in=es_uuids)
        .values_list('uuid', flat=True)
    )

    # Find missing UUIDs
    missing_from_db = set(es_uuids) - existing_uuids

    if missing_from_db:
        assert False, f"Blobs found in Elasticsearch but not in the database: {missing_from_db}"


@pytest.mark.wumpus
def test_blob_permissions():
    "Assert that all blobs are owned by jerrell and all directories have permissions 775"

    owner = "jerrell"
    walk_dir = "/home/media/blobs/"

    for file in Path(walk_dir).glob("**/*"):
        if file.is_dir():
            permissions = oct(stat(file).st_mode & 0o777)
            assert permissions == "0o775", f"Directory is not 775 {file}: {permissions}"
        elif file.is_file():
            assert getpwuid(stat(file).st_uid).pw_name == owner, f"File not owned by {owner}: {file}"


def test_blob_metadata_exists_in_elasticsearch(es):
    """Optimized version using prefetch_related and simplified ES queries"""

    metadata_qs = MetaData.objects.exclude(
        Q(blob__is_indexed=False) | Q(name="is_book") | Q(name="")
    ).select_related("blob").values(
        "name", "value", "blob__uuid"
    )

    if not metadata_qs.exists():
        return

    # Group metadata by blob UUID to reduce ES queries
    blob_metadata = defaultdict(list)
    for item in metadata_qs:
        blob_metadata[str(item["blob__uuid"])].append({
            "name": item["name"].lower(),
            "value": item["value"]
        })

    # Test in smaller, more manageable batches
    blob_uuids = list(blob_metadata.keys())
    batch_size = 200
    errors = []

    for i in range(0, len(blob_uuids), batch_size):
        batch_uuids = blob_uuids[i:i + batch_size]

        # Single ES query to get all blobs in this batch
        search_body = {
            "query": {
                "terms": {
                    "uuid": batch_uuids
                }
            },
            "size": len(batch_uuids),
            "_source": ["uuid", "metadata"]
        }

        try:
            result = es.search(index=settings.ELASTICSEARCH_INDEX, **search_body)
            found_blobs = {hit["_source"]["uuid"]: hit["_source"] for hit in result["hits"]["hits"]}

            # Verify each blob's metadata
            for uuid in batch_uuids:
                if uuid not in found_blobs:
                    errors.append(f"Blob {uuid} not found in Elasticsearch")
                    continue

                es_metadata = found_blobs[uuid].get("metadata", {})
                expected_metadata = blob_metadata[uuid]

                for meta_item in expected_metadata:
                    field_name = meta_item["name"]
                    expected_value = meta_item["value"]
                    es_value = es_metadata[field_name]
                    if expected_value not in es_value:
                        errors.append(
                            f"Blob {uuid} metadata mismatch for '{field_name}': "
                            f"expected '{expected_value}' not found in {es_value}"
                        )

        except Exception as e:
            errors.append(f"Elasticsearch error for batch {i}-{i+batch_size}: {str(e)}")

    if errors:
        assert False, "Metadata validation errors:" + "\n".join(errors)


def test_elasticsearch_search(es):
    "Assert that a simple Elasticsearch search works"

    search_object = {
        "query": {
            "multi_match": {
                "query": "carl sagan",
                "fields": ["contents", "name"]
            }
        },
        "_source": ["uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]["total"]["value"]
    assert found >= 1, "Simple Elasticsearch fails"


def test_blob_tags_match_elasticsearch(es):
    "Assert that all blob tags match those found in Elasticsearch"

    # Be sure to include "file" in the "only" method to avoid an N+1
    #  problem. See the Blob model's __init__() method.
    blobs = (
        Blob.objects
        .filter(tags__isnull=False)
        .prefetch_related("tags")
        .only("uuid", "file")
        .exclude(is_indexed=False)
        .order_by("uuid")
        .distinct("uuid")
    )

    # Convert to list once to avoid re-evaluation
    blobs_list = list(blobs)

    # Process in batches for better performance
    step = 200

    for batch_start in range(0, len(blobs_list), step):
        batch_blobs = blobs_list[batch_start:batch_start + step]

        should_queries = []
        blobs_with_tags = []  # Track which bookmarks actually have tags

        for blob in batch_blobs:
            tag_names = [tag.name for tag in blob.tags.all()]

            if tag_names:
                blobs_with_tags.append(blob)
                blob_query = {
                    "bool": {
                        "must": [
                            {
                                "term": {
                                    "uuid": str(blob.uuid)
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
                should_queries.append(blob_query)

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
            f"Blob's tags don't match those found in Elasticsearch: {get_missing_blob_ids(blobs_with_tags, found)}"


def test_blobs_have_proper_metadata():
    "Assert that all blobs have proper S3 metadata"

    s3 = boto3.resource("s3")

    for blob in Blob.objects.filter(~Q(file="")):

        obj = s3.Object(bucket_name=bucket_name, key=blob.s3_key)
        try:
            obj.metadata["file-modified"]
        except KeyError:
            assert False, f"blob uuid={blob.uuid} has no 'file-modified' S3 metadata"

        assert obj.metadata["file-modified"] != "None", f"blob uuid={blob.uuid} has 'file-modified' = 'None'"

        if obj.content_type == "binary/octet-stream":
            assert False, f"blob uuid={blob.uuid} has no proper 'Content-Type' metadata"


def test_no_empty_blob_metadata():
    "Assert that no blobs have empty metadata"
    m = MetaData.objects.filter(Q(name="") or Q(value=""))
    assert len(m) == 0, f"Empty metadata found: count={len(m)}, uuid={m.first().blob.uuid}"


def test_blobs_have_size_field(es):
    "Assert that all blobs have a size field"
    search_object = {
        "query": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "must_not": [
                                {
                                    "exists": {
                                        "field": "size"
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "term": {
                            "doctype": "blob"
                        }
                    }
                ]
            }
        },
        "from_": 0, "size": 10000,
        "_source": ["uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]
    assert found["total"]["value"] == 0, f"{found['total']['value']} blobs found with no size, uuid={found['hits'][0]['_source']['uuid']}"


def test_questions_no_tags():
    "Assert that all drill questions have at least one tag"
    t = Question.objects.filter(Q(tags__isnull=True))
    assert len(t) == 0, f"{len(t)} questions have no tags; example: {t.first().question}"


def test_no_test_data_in_elasticsearch(es):
    "Assert that there is no test data present, as identified by a '__test__' field"
    search_object = {
        "query": {
            "bool": {
                "must": {
                    "exists": {
                        "field": "__test__"
                    }
                },
            }
        },
        "from_": 0, "size": 10000,
        "_source": ["uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]

    assert found["total"]["value"] == 0, f"{found['total']['value']} documents with test data found, uuid={found['hits'][0]['_id']}"


def test_embeddings_exist(es):
    "Assert that all documents with non-empty contents also have text embeddings."
    search_object = {
        "query": {
            "bool": {
                "must": [
                    {"exists": {"field": "contents"}}
                ],
                "must_not": [
                    {"exists": {"field": "embeddings_vector"}},
                    {"term": {"metadata.is_book": "true"}}
                ]
            }
        },
        "size": 10000,
        "_source": ["contents", "uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]

    # Note that we can't filter out documents whose contents are the empty string
    # in the query, since that field is analyzed and thus whitespace would be
    # removed during analysis. Therefore we filter these out afterwards in Python.
    matches = [x for x in found["hits"] if x["_source"]["contents"] != ""]

    assert len(matches) == 0, f"{len(matches)} documents with no embeddings found, uuid={matches[0]['_id']}"
