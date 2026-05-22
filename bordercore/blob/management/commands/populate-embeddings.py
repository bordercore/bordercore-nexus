# Update a blob's embeddings_vector field in Elasticsearch

import json
import sys

import boto3

import django
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import QuerySet

from lib.util import get_elasticsearch_connection

client = boto3.client("lambda")

django.setup()

from blob.models import Blob

es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)


class Command(BaseCommand):
    help = "Update blob embeddings-vector fields in Elasticsearch via CreateEmbeddings"

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            help="The maximum number of blobs to process",
            type=int,
            default=10000,
        )
        parser.add_argument(
            "--dry-run",
            help="Dry run. Take no action",
            action="store_true",
        )
        parser.add_argument(
            "--force",
            help="Re-embed blobs even when embeddings_vector already exists",
            action="store_true",
        )
        parser.add_argument(
            "--notes-only",
            help="Only process blobs marked as notes (is_note=True)",
            action="store_true",
        )

    def handle(self, *args, limit, dry_run, force, notes_only, **kwargs):
        queryset = self._candidate_queryset(notes_only=notes_only)
        self.stdout.write(f"Total blobs in scope: {queryset.count()}")

        count = 0
        for blob in queryset.iterator():
            if not force and not self._blob_needs_embedding(blob.uuid):
                continue

            self.stdout.write(f"Re-embedding {blob.uuid} {blob.name}")
            count += 1

            if not dry_run:
                try:
                    response = client.invoke(
                        FunctionName="CreateEmbeddings",
                        InvocationType="Event",
                        Payload=json.dumps({"uuid": str(blob.uuid)}),
                    )
                    if response["StatusCode"] != 202:
                        self.stderr.write(str(response))
                        sys.exit(1)
                except Exception as e:
                    self.stderr.write(f"Exception during invoke_lambda: {e}")
                    sys.exit(1)

            if count >= limit:
                break

        self.stdout.write(f"Queued {count} blob(s) for embedding.")

    def _candidate_queryset(self, *, notes_only: bool) -> QuerySet[Blob]:
        """Return blobs with non-empty content, optionally limited to notes."""
        queryset = Blob.objects.exclude(content="")
        if notes_only:
            queryset = queryset.filter(is_note=True)
        return queryset.order_by("uuid")

    def _blob_needs_embedding(self, uuid) -> bool:
        """Return True when the Elasticsearch document lacks embeddings_vector."""
        search_object = {
            "query": {
                "function_score": {
                    "random_score": {},
                    "query": {
                        "bool": {
                            "must": [
                                {
                                    "bool": {
                                        "must_not": [
                                            {
                                                "exists": {
                                                    "field": "embeddings_vector",
                                                }
                                            }
                                        ]
                                    }
                                },
                                {
                                    "term": {
                                        "uuid": uuid,
                                    }
                                },
                            ]
                        }
                    },
                }
            },
            "from_": 0,
            "_source": ["name", "uuid"],
        }

        return (
            len(es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]["hits"])
            > 0
        )
