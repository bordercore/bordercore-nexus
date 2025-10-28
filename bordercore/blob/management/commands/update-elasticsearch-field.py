# Update a blob's field in Elasticsearch

import sys

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.transaction import atomic

from lib.util import get_elasticsearch_connection

es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)


class Command(BaseCommand):
    help = "Update a blob's field in Elasticsearch"

    def add_arguments(self, parser):
        parser.add_argument(
            "--uuid",
            required=True,
            help="The uuid of the blob to update",
        )
        parser.add_argument(
            "--field",
            required=True,
            help="The field to update",
        )
        parser.add_argument(
            "--value",
            required=True,
            help="The new field value",
        )

    @atomic
    def handle(self, *args, uuid, field, value, **kwargs):

        self.es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

        content_type_old = self.get_current_value(uuid, field)
        self.stdout.write(f"Current content type: {content_type_old}")

        if content_type_old == value:
            self.stderr.write("Error: The blob already has that field value set.")
            sys.exit(1)

        self.set_content_type(uuid, field, value)

    def get_current_value(self, uuid, field):

        search_object = {
            "query": {
                "term": {
                    "uuid": uuid,
                }
            },
            "from_": 0,
            "size": 1,
            "_source": [field]
        }

        return self.es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]["hits"][0]["_source"][field]

    def set_content_type(self, uuid, field, value):

        request_body = {
            "query": {
                "term": {
                    "uuid": uuid
                }
            },
            "script": {
                "source": f"ctx._source.{field}='{value}'",
                "lang": "painless"
            }
        }

        return self.es.update_by_query(index=settings.ELASTICSEARCH_INDEX, body=request_body)
