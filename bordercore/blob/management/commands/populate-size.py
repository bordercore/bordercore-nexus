"""Populate the size field for blobs in Elasticsearch.

Walks the local blob filesystem, reads each file's size, and updates the
corresponding Elasticsearch document with a ``size`` field if one does not
already exist.
"""

import re
import sys
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.transaction import atomic

from blob.models import Blob
from lib.util import get_elasticsearch_connection


class Command(BaseCommand):
    """Management command to populate blob size fields in Elasticsearch."""

    help = "Update a blob's size field in Elasticsearch"

    BLOB_DIR = "/home/media"
    index_name = "bordercore"

    def add_arguments(self, parser):
        """Add the --limit argument to the command parser.

        Args:
            parser: The argument parser for the management command.
        """
        parser.add_argument(
            "--limit",
            help="The maximum number of blobs to process",
            default=10000
        )

    @atomic
    def handle(self, *args, limit, **kwargs):
        """Walk blobs on disk and update Elasticsearch with file sizes.

        Args:
            *args: Variable length argument list.
            limit: Maximum number of blobs to process.
            **kwargs: Additional keyword arguments.
        """
        self.es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

        count = 0

        # Set this to False to activate the "resume" feature
        go = True

        for x in Path(f"{self.BLOB_DIR}/blobs").rglob("*"):
            if x.is_file():
                m = re.search(r"^/home/media/blobs/\w{2}/(\w{40})/(.+)", str(x))
                if m:
                    count = count + 1
                    sha1sum = m.group(1)

                    # Resume after this sha1sum has been seen
                    if sha1sum == "8f73de65a0902d836df4bf5f11fd080d583e2d3e":
                        go = True

                    if not go:
                        continue

                    filename = m.group(2)

                    if filename in ["cover.jpg", "cover-small.jpg", "cover-large.jpg"]:
                        continue

                    self.stdout.write(f"{sha1sum} {x}")

                    if self.has_size_field(sha1sum):
                        continue

                    blob = Blob.objects.get(sha1sum=sha1sum)
                    with open(x, "rb") as content_file:
                        content = content_file.read()

                    size = len(content)

                    result = self.update_metadata(blob.uuid, size)
                    self.stdout.write(f" {blob.uuid} update size to {size}: {result}")

                    count = count + 1
                    if count == limit:
                        sys.exit(0)

    def has_size_field(self, sha1sum):
        """Check whether the Elasticsearch document for a blob already has a size field.

        Args:
            sha1sum: The sha1sum identifying the blob.

        Returns:
            List of matching Elasticsearch hits (truthy if size exists).
        """
        body = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "term": {
                                "user_id": 1
                            }
                        },
                        {
                            "term": {
                                "sha1sum": sha1sum
                            }
                        },
                        {
                            "bool": {
                                "must": [
                                    {
                                        "exists": {
                                            "field": "size"
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
            "from": 0, "size": 1,
            "_source": ["title",
                        "uuid"]
        }

        results = self.es.search(index=self.index_name, body=body)
        return(results["hits"]["hits"])

    def update_metadata(self, uuid, size):
        """Update the size field in the blob's Elasticsearch document.

        Args:
            uuid: The UUID of the blob to update.
            size: The file size in bytes.

        Returns:
            Elasticsearch update_by_query response.
        """
        request_body = {
            "query": {
                "term": {
                    "uuid": uuid
                }
            },
            "script": {
                "source": f"ctx._source.size={size}",
                "lang": "painless"
            }
        }

        return self.es.update_by_query(index=self.index_name, body=request_body)
