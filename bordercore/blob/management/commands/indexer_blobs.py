import signal
import sys

import urllib3

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.transaction import atomic

from blob.elasticsearch_indexer import index_blob
from lib.util import get_elasticsearch_connection

from blob.models import Blob  # isort:skip

urllib3.disable_warnings()

es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)


def handler(signum, frame):
    sys.exit(0)


signal.signal(signal.SIGINT, handler)


class Command(BaseCommand):
    help = "Re-index all blobs in Elasticsearch"

    BATCH_SIZE = 10
    LAST_BLOB_FILE = "/tmp/indexer_es_last_blob.txt"

    def add_arguments(self, parser):
        parser.add_argument(
            "--uuid",
            help="The uuid of a single blob to index",
        )
        parser.add_argument(
            "--force",
            help="Force indexing even if the blob already exists in Elasticsearch",
            action="store_true",
            default=False
        )
        parser.add_argument(
            "--limit",
            help="Limit the number of blobs indexed",
            default=100000,
            type=int
        )
        parser.add_argument(
            "--verbose",
            help="Increase output verbosity",
            action="store_true"
        )
        parser.add_argument(
            "--create-connection",
            help="Create connection to Elasticsearch",
            default=False,
            action="store_true"
        )

    def get_missing_blob_ids(self, expected, found):

        found_ids = [x["_id"] for x in found["hits"]["hits"]]
        return [x for x in expected if str(x.uuid) not in found_ids]

    def get_blobs_from_es(self):

        search_object = {
            "query": {
                "bool": {
                    "should": [
                        {
                            "term": {
                                "doctype": "blob"
                            }
                        },
                        {
                            "term": {
                                "doctype": "document"
                            }
                        },
                        {
                            "term": {
                                "doctype": "note"
                            }
                        },
                        {
                            "term": {
                                "doctype": "book"
                            }
                        },
                    ]
                }
            },
            "size": 10000,
            "_source": ["uuid"]
        }

        found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)

        blobs = {}
        for match in found["hits"]["hits"]:
            blobs[match["_source"]["uuid"]] = True

        return blobs

    def find_missing_blobs(self, force, create_connection, limit):

        if not force:
            self.stdout.write("Getting blob list from Elasticsearch...")
            blobs_in_es = self.get_blobs_from_es()

        self.stdout.write("Getting blob list from the database...")

        blobs_in_db = Blob.objects.filter(is_indexed=True) \
                                  .only("uuid", "name") \
                                  .values()

        blobs_indexed = 0

        if force:
            missing_blobs = blobs_in_db
        else:
            self.stdout.write("Getting missing blob list...")
            missing_blobs = [x for x in blobs_in_db if str(x["uuid"]) not in blobs_in_es]
            self.stdout.write(f"Found {len(missing_blobs)} missing blobs...")

        for blob in missing_blobs:
            self.stdout.write(f"{blob['uuid']} {blob['name']}")
            index_blob(uuid=blob["uuid"], create_connection=create_connection)
            blobs_indexed = blobs_indexed + 1
            if blobs_indexed == limit:
                return

    @atomic
    def handle(self, *args, uuid, force, create_connection, limit, verbose, **kwargs):

        if uuid:
            blob = Blob.objects.get(uuid=uuid)
            index_blob(uuid=blob.uuid, create_connection=create_connection)
        else:
            self.find_missing_blobs(force, create_connection, limit)
