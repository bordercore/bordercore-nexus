# Update a blob's embeddings_vector field in Elasticsearch

import json
import sys

import boto3

import django
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.transaction import atomic

from lib.util import get_elasticsearch_connection

client = boto3.client("lambda")

django.setup()

from blob.models import Blob

es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)


class Command(BaseCommand):
    help = "Update a blob's embeddings-vector field in Elasticsearch"

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            help="The maximum number of blobs to process",
            type=int,
            default=10000
        )
        parser.add_argument(
            "--dry-run",
            help="Dry run. Take no action",
            action="store_true"
        )

    @atomic
    def handle(self, *args, limit, dry_run, **kwargs):

        count = 0

        found = Blob.objects.filter(content__isnull=False).exclude(content="")
        self.stdout.write(f"Total blobs possibly needing updating: {found.count()}")

        for hit in found:

            if self.check_if_blob_needs_update(hit.uuid):
                self.stdout.write(f"Re-indexing {hit.uuid} {hit.name}")

                count = count + 1

                if not dry_run:
                    try:

                        response = client.invoke(
                            FunctionName="CreateEmbeddings",
                            InvocationType="Event",
                            Payload=json.dumps({"uuid": str(hit.uuid)})
                        )

                        if response["StatusCode"] != 202:
                            self.stdoute.write(response)
                            sys.exit(0)

                    except Exception as e:
                        self.stderror.write(f"Exception during invoke_lambda: {e}")

                if count == limit:
                    sys.exit(0)

    def check_if_blob_needs_update(self, uuid):
        # Check to see if a blob has an empty embeddings-vector field

        search_object = {
            "query": {
                "function_score": {
                    "random_score": {
                    },
                    "query": {
                        "bool": {
                            "must": [
                                {
                                    "bool": {
                                        "must_not": [
                                            {
                                                "exists": {
                                                    "field": "embeddings_vector"
                                                }
                                            }
                                        ]
                                    }
                                },
                                {
                                    "term": {
                                        "uuid": uuid
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            "from_": 0,
            "_source": ["name", "uuid"]
        }

        return len(es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]["hits"]) > 0
