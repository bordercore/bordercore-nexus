"""Fix cover image content types in S3.

Scans all cover images in the S3 bucket and corrects any whose Content-Type
is not ``image/jpeg`` by performing an in-place copy with the correct type.
"""

import re

import boto3

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.transaction import atomic


class Command(BaseCommand):
    """Management command to fix cover image Content-Type headers in S3."""

    help = "Set a cover image's content type field to 'image/jpeg'"

    bucket_name = settings.AWS_STORAGE_BUCKET_NAME

    def add_arguments(self, parser):
        """Add --uuid and --dry-run arguments.

        Args:
            parser: The argument parser for the management command.
        """
        parser.add_argument(
            "--uuid",
            help="The uuid of the blob to fix",
        )
        parser.add_argument(
            "--dry-run",
            help="Dry run. Take no action",
            action="store_true"
        )

    @atomic
    def handle(self, *args, uuid, dry_run, **kwargs):
        """Scan cover images in S3 and fix incorrect Content-Type headers.

        Args:
            *args: Variable length argument list.
            uuid: Optional UUID to limit the fix to a single blob.
            dry_run: If True, log actions without making changes.
            **kwargs: Additional keyword arguments.
        """
        s3_resource = boto3.resource("s3")

        paginator = s3_resource.meta.client.get_paginator("list_objects")
        page_iterator = paginator.paginate(Bucket=self.bucket_name)

        for page in page_iterator:
            for key in page["Contents"]:

                m = re.search(r"^blobs/(.*?)/(cover.*)", str(key["Key"]))

                if m:

                    if not uuid or (uuid and uuid == m.group(1)):
                        response = s3_resource.meta.client.head_object(Bucket=self.bucket_name, Key=key["Key"])

                        if response["ContentType"] != "image/jpeg":
                            print(f"Fixing {m.group(1)}")
                            if not dry_run:
                                s3_object = s3_resource.Object(self.bucket_name, key["Key"])
                                s3_object.copy_from(
                                    CopySource={"Bucket": self.bucket_name, "Key": key["Key"]},
                                    Metadata=s3_object.metadata,
                                    MetadataDirective="REPLACE",
                                    ContentType="image/jpeg")

                            # sys.exit(0)
