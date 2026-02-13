"""Sync all filesystem blobs to S3.

Iterates over all blobs with a file and uploads any that are missing from S3,
optionally setting the file-modified metadata header.
"""

import os

import boto3
from botocore.errorfactory import ClientError

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.db.transaction import atomic

from blob.models import Blob, set_s3_metadata_file_modified


class Command(BaseCommand):
    """Management command to upload local blobs missing from S3."""

    help = "Sync all filesystem blobs to S3"

    bucket_name = settings.AWS_STORAGE_BUCKET_NAME

    def add_arguments(self, parser):
        """Add --dry-run and --verbose arguments.

        Args:
            parser: The argument parser for the management command.
        """
        parser.add_argument(
            "--dry-run",
            help="Dry run. Take no action",
            action="store_true"
        )
        parser.add_argument(
            "--verbose",
            help="Increase verbosity",
            action="store_true"
        )

    @atomic
    def handle(self, *args, dry_run, verbose, **kwargs):
        """Upload blobs that are missing from S3.

        Args:
            *args: Variable length argument list.
            dry_run: If True, log actions without uploading.
            verbose: If True, log already-synced blobs.
            **kwargs: Additional keyword arguments.
        """
        s3_client = boto3.client("s3")

        for blob in Blob.objects.filter(~Q(file="")).order_by("?"):

            key = blob.s3_key

            try:
                s3_client.head_object(Bucket=self.bucket_name, Key=key)
                if verbose:
                    self.stdout.write("{blob.uuid} Blob already exists in S3")
            except ClientError:
                self.stdout.write(f"{blob.uuid} Syncing to S3")

                if not dry_run:
                    file_path = f"/home/media/{key}"
                    s3_client.upload_file(file_path, self.bucket_name, key)

                    # Set the file modification header
                    info = os.stat(file_path)
                    blob.file_modified = info[8]
                    set_s3_metadata_file_modified(None, blob)
