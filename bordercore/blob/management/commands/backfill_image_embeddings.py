"""Bulk-encode every image blob and write its CLIP embedding to ES.

Run on a host with GPU + sentence-transformers + torch installed
(wumpus's pytorch env). Reads each image blob's 640px cover thumbnail
directly from S3, encodes in batches on the GPU, and writes the resulting
embedding to ES via the same Painless _update script the Lambda uses.

Invocation (note: NOT through `make manage` — this needs the pytorch env,
not the project's .venv):

    PYTHONPATH=. /home/jerrell/dev/envs/pytorch/bin/python manage.py \\
        backfill_image_embeddings [--limit N] [--no-skip-existing]
"""
from io import BytesIO
from urllib.parse import urlparse

import boto3
import requests
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import Q

from blob.models import Blob

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif")
BATCH_SIZE = 64
THUMBNAIL_KEY = "blobs/{uuid}/cover.jpg"
ES_PORT = 9200


def _es_host_from_endpoint(endpoint: str) -> str:
    """Accept either a bare hostname or an http(s):// URL; return just the host."""
    if "://" in endpoint:
        return urlparse(endpoint).hostname or endpoint
    return endpoint


class Command(BaseCommand):
    help = "Encode all image blobs with CLIP and write embeddings to ES."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Process at most N blobs (for testing).",
        )
        parser.add_argument(
            "--no-skip-existing",
            action="store_true",
            help="Re-encode blobs that already have an image_embedding in ES.",
        )

    def handle(self, *args, **opts):
        from sentence_transformers import SentenceTransformer  # type: ignore[import-untyped]

        es_host = _es_host_from_endpoint(
            getattr(settings, "ELASTICSEARCH_ENDPOINT", "localhost")
        )
        es_index = settings.ELASTICSEARCH_INDEX
        bucket = settings.AWS_STORAGE_BUCKET_NAME
        skip_existing = not opts["no_skip_existing"]
        s3 = boto3.client("s3")

        ext_q = Q()
        for ext in IMAGE_EXTS:
            ext_q |= Q(file__iendswith=ext)
        qs = Blob.objects.exclude(is_note=True).filter(ext_q)
        if opts["limit"]:
            qs = qs[: opts["limit"]]
        blobs = list(qs.values_list("uuid", flat=True))
        self.stdout.write(f"Found {len(blobs)} image blobs")

        if skip_existing:
            blobs = [u for u in blobs if not self._already_indexed(u, es_host, es_index)]
            self.stdout.write(f"{len(blobs)} remain after skip-existing filter")

        if not blobs:
            return

        self.stdout.write("Loading CLIP model on GPU (first run downloads ~150 MB)...")
        model = SentenceTransformer("clip-ViT-B-32")

        total = len(blobs)
        for i in range(0, total, BATCH_SIZE):
            batch = blobs[i : i + BATCH_SIZE]
            images = []
            uuids = []
            for uuid in batch:
                img = self._fetch_thumbnail(s3, bucket, uuid)
                if img is None:
                    continue
                images.append(img)
                uuids.append(str(uuid))
            if not images:
                continue
            vectors = model.encode(
                images,
                batch_size=BATCH_SIZE,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            for uuid, vec in zip(uuids, vectors):
                self._write(uuid, vec.tolist(), es_host, es_index)
            self.stdout.write(
                f"Processed {min(i + BATCH_SIZE, total)} / {total}"
                f" ({len(images)} encoded in this batch)"
            )

    def _fetch_thumbnail(self, s3, bucket, uuid):
        from PIL import Image  # type: ignore[import-untyped]

        try:
            response = s3.get_object(
                Bucket=bucket, Key=THUMBNAIL_KEY.format(uuid=uuid)
            )
            data = response["Body"].read()
            return Image.open(BytesIO(data)).convert("RGB")
        except s3.exceptions.NoSuchKey:
            self.stderr.write(f"  skip {uuid}: no cover.jpg in S3")
            return None
        except Exception as e:
            self.stderr.write(f"  skip {uuid}: {e}")
            return None

    def _already_indexed(self, uuid, host, index) -> bool:
        url = (
            f"http://{host}:{ES_PORT}/{index}/_doc/{uuid}"
            "?_source_includes=image_embedding"
        )
        try:
            r = requests.get(url, timeout=5)
            if r.status_code != 200:
                return False
            return "image_embedding" in r.json().get("_source", {})
        except requests.RequestException:
            return False

    def _write(self, uuid: str, vec: list, host: str, index: str) -> None:
        body = {
            "script": {
                "source": "ctx._source.image_embedding = params.value",
                "lang": "painless",
                "params": {"value": vec},
            }
        }
        url = f"http://{host}:{ES_PORT}/{index}/_update/{uuid}"
        r = requests.post(url, json=body, timeout=10)
        r.raise_for_status()
