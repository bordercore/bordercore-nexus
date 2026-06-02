"""Add the image_embedding dense_vector field to the bordercore index."""
from django.conf import settings
from django.core.management.base import BaseCommand

from lib.util import get_elasticsearch_connection


class Command(BaseCommand):
    """Add the image_embedding dense_vector mapping to the Elasticsearch blob index."""

    help = "Add the image_embedding dense_vector field to the ES blob mapping."

    def handle(self, *args, **options):
        """Execute the mapping update and report success to stdout."""
        es = get_elasticsearch_connection()
        body = {
            "properties": {
                "image_embedding": {
                    "type": "dense_vector",
                    "dims": 512,
                    "index": True,
                    "similarity": "cosine",
                    "index_options": {"type": "int8_hnsw"},
                }
            }
        }
        es.indices.put_mapping(index=settings.ELASTICSEARCH_INDEX, properties=body["properties"])
        self.stdout.write(self.style.SUCCESS("image_embedding field added"))
