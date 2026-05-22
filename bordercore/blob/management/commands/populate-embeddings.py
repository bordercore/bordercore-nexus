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
        parser.add_argument(
            "--async",
            dest="invoke_async",
            help="Queue Lambda invocations without waiting for results (fire-and-forget)",
            action="store_true",
        )

    def handle(self, *args, limit, dry_run, force, notes_only, invoke_async, **kwargs):
        queryset = self._candidate_queryset(notes_only=notes_only)
        self.stdout.write(f"Total blobs in scope: {queryset.count()}")

        count = 0
        failures = 0
        for blob in queryset.iterator():
            if not force and not self._blob_needs_embedding(blob.uuid):
                continue

            self.stdout.write(f"Re-embedding {blob.uuid} {blob.name}")
            count += 1

            if not dry_run:
                if not self._invoke_embedding(str(blob.uuid), invoke_async=invoke_async):
                    failures += 1
                    self.stderr.write(
                        self.style.ERROR(
                            f"Failed to embed {blob.uuid} {blob.name!r}. "
                            "See /aws/lambda/CreateEmbeddings in CloudWatch for details."
                        )
                    )

            if count >= limit:
                break

        if dry_run:
            self.stdout.write(f"Would queue {count} blob(s) for embedding.")
            return

        mode = "Queued" if invoke_async else "Processed"
        self.stdout.write(f"{mode} {count} blob(s) for embedding.")
        if failures:
            self.stderr.write(
                self.style.ERROR(f"{failures} of {count} embedding invocation(s) failed.")
            )
            sys.exit(1)

    def _invoke_embedding(self, blob_uuid: str, *, invoke_async: bool) -> bool:
        """Invoke CreateEmbeddings and return True on success.

        By default uses synchronous invocation so embedding and Elasticsearch
        store errors fail the management command immediately. Pass
        ``invoke_async=True`` to queue work without waiting for results.
        """
        try:
            response = client.invoke(
                FunctionName="CreateEmbeddings",
                InvocationType="Event" if invoke_async else "RequestResponse",
                Payload=json.dumps({"uuid": blob_uuid}),
            )
        except Exception as e:
            self.stderr.write(f"Exception during invoke_lambda for {blob_uuid}: {e}")
            return False

        status_code = response.get("StatusCode", 0)
        if invoke_async:
            return status_code == 202

        if status_code != 200 or response.get("FunctionError"):
            error_payload = response.get("Payload")
            if error_payload is not None:
                body = error_payload.read().decode("utf-8", errors="replace")
                if body:
                    self.stderr.write(f"Lambda error for {blob_uuid}: {body}")
            return False

        return True

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
