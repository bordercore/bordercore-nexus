"""Script to invoke Chromda Lambda function for bookmark thumbnail creation.

This module provides a command-line script to trigger the Chromda Lambda
function that creates thumbnail images for bookmarks using Puppeteer screenshots.
It can process individual bookmarks or batch process all bookmarks that don't
have thumbnails yet.
"""

import argparse
import json
import re
import time
from uuid import UUID

import boto3

import django
from django.conf import settings

django.setup()

from bookmark.models import Bookmark  # isort:skip

client = boto3.client("lambda")

DELAY = 5


def populate_action(dry_run: bool) -> None:
    """Process all bookmarks that don't have thumbnails in S3.

    Scans S3 bucket for existing bookmark thumbnails, identifies bookmarks
    without thumbnails, and invokes the Chromda Lambda function for each
    missing thumbnail. Includes a delay between invocations to avoid
    overwhelming the system.

    Args:
        dry_run: If True, only print what would be processed without
            actually invoking the Lambda function.
    """

    bucket_name = settings.AWS_STORAGE_BUCKET_NAME
    s3_resource = boto3.resource("s3")
    unique_uuids = set()

    paginator = s3_resource.meta.client.get_paginator("list_objects_v2")
    page_iterator = paginator.paginate(Bucket=bucket_name)

    for page in page_iterator:
        for key in page["Contents"]:
            m = re.search(r"^bookmarks/(\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b)", str(key["Key"]))
            if m:
                # print(m.group(1))
                unique_uuids.add(m.group(1))

    to_process = [x for x in Bookmark.objects.all() if str(x.uuid) not in unique_uuids]
    print(f"Processing {len(to_process)} bookmarks")

    for bookmark in to_process:
        print(f"{bookmark.uuid} {bookmark.created} {bookmark.name}")
        if not dry_run:
            invoke(bookmark.uuid, dry_run)
            time.sleep(DELAY)


def invoke(uuid: str | UUID, dry_run: bool) -> None:
    """Invoke the Chromda Lambda function to create a bookmark thumbnail.

    Retrieves the bookmark by UUID and publishes a message to SNS that triggers
    the Chromda Lambda function to create a screenshot-based thumbnail using
    Puppeteer. The thumbnail is saved to S3 at the specified key.

    Args:
        uuid: UUID string or UUID object identifying the bookmark to process.
        dry_run: If True, no action is taken (unused in this function but
            included for consistency with populate_action).
    """

    bookmark = Bookmark.objects.get(uuid=uuid)

    SNS_TOPIC = settings.SNS_TOPIC_ARN
    client = boto3.client("sns")

    message = {
        "url": bookmark.url,
        "s3key": f"bookmarks/{bookmark.uuid}.png",
        "puppeteer": {
            "screenshot": {
                "type": "jpeg",
                "quality": 50,
                "omitBackground": False
            }
        }
    }

    client.publish(
        TopicArn=SNS_TOPIC,
        Message=json.dumps(message),
    )


if __name__ == "__main__":

    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--uuid", "-u", type=str,
                       help="the uuid of the bookmark to index")
    group.add_argument("--all", "-a", action="store_true",
                       help="create thumbnails for all bookmarks that need them")
    parser.add_argument("--dry-run", "-n", action="store_true",
                        help="Dry run. Take no action")

    args = parser.parse_args()

    uuid = args.uuid
    all = args.all
    dry_run = args.dry_run

    if uuid:
        invoke(uuid, dry_run)
    elif all:
        populate_action(dry_run)
