"""Regenerate blob thumbnails by re-invoking the CreateThumbnail Lambda.

For each matching blob, builds the same SNS-wrapped S3 event payload that
production uses and invokes the Lambda asynchronously
(``InvocationType=Event``). Useful after changing thumbnail dimensions or
quality in ``aws/create_thumbnail/lib/thumbnails.py``.

Examples:
    # Regenerate all image/pdf/video thumbnails for all users
    manage.py regenerate_thumbnails

    # Single blob
    manage.py regenerate_thumbnails --uuid 1cef06d3-993f-467f-8a39-0b86b3995335

    # Limit to one user, images only, dry run
    manage.py regenerate_thumbnails --user jerrell --type image --dry-run

    # Cap throttle at 5 invocations per second
    manage.py regenerate_thumbnails --rate 5
"""

import json
import time
from typing import Iterable

import boto3
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from blob.models import Blob

# Extension groups that the CreateThumbnail Lambda knows how to handle.
TYPE_EXTENSIONS = {
    "image": (".jpg", ".jpeg", ".png", ".gif"),
    "pdf": (".pdf",),
    "video": (".mp4", ".webm", ".mkv", ".mov"),
    "text": (".txt",),
}


class Command(BaseCommand):
    """Re-invoke the CreateThumbnail Lambda for matching blobs."""

    help = "Regenerate blob thumbnails by re-invoking the CreateThumbnail Lambda"

    def add_arguments(self, parser):
        parser.add_argument(
            "--uuid",
            help="Process a single blob by UUID (overrides other filters)",
        )
        parser.add_argument(
            "--user",
            help="Limit to a single user (by username)",
        )
        parser.add_argument(
            "--type",
            choices=["image", "pdf", "video", "text", "all"],
            default="all",
            help="File-type group to process (default: all thumb-able types)",
        )
        parser.add_argument(
            "--limit",
            type=int,
            help="Maximum number of blobs to invoke",
        )
        parser.add_argument(
            "--rate",
            type=float,
            default=10.0,
            help="Max Lambda invocations per second (default: 10)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List the blobs that would be processed; don't invoke Lambda",
        )

    def handle(self, *args, uuid, user, type, limit, rate, dry_run, **kwargs):
        blobs = self._select_blobs(uuid=uuid, user=user, file_type=type, limit=limit)

        if dry_run:
            count = 0
            for blob_uuid, file_path in blobs:
                self.stdout.write(f"{blob_uuid}  {file_path}")
                count += 1
            self.stdout.write(self.style.NOTICE(f"\n{count} blob(s) would be processed (dry run)"))
            return

        client = boto3.client("lambda")
        bucket = settings.AWS_STORAGE_BUCKET_NAME
        interval = 1.0 / rate if rate > 0 else 0.0

        ok = 0
        failed = 0
        for i, (blob_uuid, file_path) in enumerate(blobs, start=1):
            payload = _build_payload(bucket, blob_uuid, file_path)
            try:
                client.invoke(
                    FunctionName="CreateThumbnail",
                    InvocationType="Event",
                    Payload=json.dumps(payload),
                )
                ok += 1
            except Exception as err:
                failed += 1
                self.stderr.write(self.style.ERROR(f"  {blob_uuid}: {err}"))
                continue

            if i % 50 == 0 or i == 1:
                self.stdout.write(f"[{i}] invoked {blob_uuid}")

            if interval:
                time.sleep(interval)

        self.stdout.write(self.style.SUCCESS(f"\nInvoked: {ok}    Failed: {failed}"))

    def _select_blobs(
        self,
        *,
        uuid: str | None,
        user: str | None,
        file_type: str,
        limit: int | None,
    ) -> Iterable[tuple[str, str]]:
        """Return ``(uuid, file)`` tuples for blobs to process."""
        qs = Blob.objects.exclude(file="").exclude(is_note=True)

        if uuid:
            qs = qs.filter(uuid=uuid)
            if not qs.exists():
                raise CommandError(f"No blob found with uuid={uuid}")
        else:
            if user:
                User = get_user_model()
                try:
                    user_obj = User.objects.get(username=user)
                except User.DoesNotExist as exc:
                    raise CommandError(f"No user with username={user}") from exc
                qs = qs.filter(user=user_obj)

            if file_type == "all":
                exts = sum(TYPE_EXTENSIONS.values(), ())
            else:
                exts = TYPE_EXTENSIONS[file_type]

            # iregex is faster than chained Q(file__iendswith=...) for this
            # since the column is text and the regex is anchored at end.
            pattern = r"\.(" + "|".join(e.lstrip(".") for e in exts) + r")$"
            qs = qs.filter(file__iregex=pattern)

        qs = qs.order_by("created").values_list("uuid", "file")

        if limit:
            qs = qs[:limit]

        return qs


def _build_payload(bucket: str, blob_uuid: str, file_path: str) -> dict:
    """Construct the SNS-wrapped S3 event payload the Lambda expects."""
    message = {
        "Records": [
            {
                "eventName": "ObjectCreated: Put",
                "s3": {
                    "bucket": {"name": bucket},
                    "object": {"key": f"blobs/{blob_uuid}/{file_path}"},
                },
            }
        ]
    }
    return {
        "Records": [
            {"Sns": {"Message": json.dumps(message)}}
        ]
    }
