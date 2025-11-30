"""AWS Lambda function for creating blob and bookmark thumbnails.

This module provides an AWS Lambda handler that processes S3 object creation
events to generate thumbnail images for blobs and bookmarks. It downloads
files from S3, creates thumbnails using the thumbnail service, and uploads
them back to S3 with appropriate metadata.

Sequence of events:
- S3 object is downloaded to /tmp/blobs/<uuid>-<filename>
- For PDFs, a specific page is extracted
- Thumbnails are created in /tmp/covers/<uuid>-cover*.jpg
- Cover images are uploaded to S3 with metadata
- Temporary files are cleaned up

For bookmarks, only a small cover image is created since Chromda generates
the large version based on the webpage.
"""

import glob
import json
import logging
import os
import re
from pathlib import PurePath
from typing import Any
from urllib.parse import unquote_plus

import boto3
from PIL import Image

from lib.thumbnails import create_thumbnail

logging.getLogger().setLevel(logging.INFO)
log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)

s3_client = boto3.client("s3")
s3_resource = boto3.resource("s3")
EFS_DIR = os.environ.get("EFS_DIR", "/tmp")
BLOBS_DIR = f"{EFS_DIR}/blobs"
COVERS_DIR = f"{EFS_DIR}/covers"


def is_cover_image(bucket: str, key: str) -> bool:
    """Check if an S3 object is a cover image based on metadata.

    Cover images are identified by having the "cover-image" metadata key
    set to "Yes". This function checks the S3 object metadata to determine
    if it's a cover image.

    Args:
        bucket: S3 bucket name containing the object.
        key: S3 object key (path) to check.

    Returns:
        True if the object has cover-image metadata set to "Yes", False otherwise.
    """
    response = s3_client.head_object(Bucket=bucket, Key=key)

    return response["Metadata"].get("cover-image", None) == "Yes"


def extract_uuid(key: str) -> str:
    """Extract UUID from an S3 key path.

    Searches for a UUID pattern (8-4-4-4-12 hexadecimal digits) in the key
    and returns the first match.

    Args:
        key: S3 object key (path) containing a UUID.

    Returns:
        UUID string extracted from the key.

    Raises:
        ValueError: If no UUID pattern is found in the key.
    """
    # UUID format: 8-4-4-4-12 hexadecimal digits
    uuid_pattern = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    match = re.search(uuid_pattern, key)
    if match:
        return match.group()
    else:
        raise ValueError(f"Can't extract uuid from key: {key}")


def get_cover_filename(key: str, uuid: str, is_bookmark: bool) -> str:
    """Determine the cover image filename based on object type.

    For blobs, extracts the filename from the local path (cover.jpg or
    cover-large.jpg). For bookmarks, generates the filename as
    <uuid>-small.png.

    Args:
        key: Local file path to the cover image.
        uuid: UUID string of the blob or bookmark.
        is_bookmark: True if processing a bookmark, False for a blob.

    Returns:
        Cover image filename string.
    """

    if is_bookmark:
        cover_filename = f"{uuid}-small.png"
    else:
        _, cover_filename = key.split(f"{COVERS_DIR}/{uuid}-")

    return cover_filename


def handler(event: dict[str, Any], context: Any) -> None:
    """AWS Lambda handler for processing S3 blob and bookmark uploads.

    Processes S3 object creation events to generate thumbnail images for
    blobs and bookmarks. Downloads files from S3, creates thumbnails, and
    uploads them back to S3 with metadata. Skips cover images and delete
    events.

    Args:
        event: Lambda event dictionary containing SNS records with S3 events.
        context: Lambda context object (unused but required by Lambda interface).
    """

    try:

        for record in event["Records"]:
            log.info(json.dumps(record["Sns"]["Message"]))
            sns_record = json.loads(record["Sns"]["Message"])["Records"][0]
            bucket = sns_record["s3"]["bucket"]["name"]

            # Ignore object delete events
            if sns_record["eventName"] == "ObjectRemoved:Delete":
                continue

            # Spaces are replaced with "+"s
            key = unquote_plus(sns_record["s3"]["object"]["key"])

            is_bookmark = key.startswith("bookmarks/")

            # Look for an optional page number (for pdfs)
            page_number = sns_record["s3"]["object"].get("page_number", 1)

            log.info(f"Creating cover image for {key}")

            p = PurePath(key)
            path = p.parent
            filename = p.name

            if is_cover_image(bucket, key):
                log.info(f"Skipping cover image {filename}")
                continue

            uuid = extract_uuid(key)

            try:
                os.mkdir(BLOBS_DIR)
            except FileExistsError:
                pass

            try:
                os.mkdir(COVERS_DIR)
            except FileExistsError:
                pass

            download_path = f"{BLOBS_DIR}/{uuid}-{filename}"

            s3_client.download_file(bucket, key, download_path)
            create_thumbnail(download_path, f"{COVERS_DIR}/{uuid}", page_number)

            # Upload all cover images created (large or small) to S3
            for cover in glob.glob(f"{COVERS_DIR}/{uuid}-cover*"):
                width, height = Image.open(cover).size
                cover_filename = get_cover_filename(cover, uuid, is_bookmark)
                log.info(f"coverfile: {cover_filename}")
                s3_client.upload_file(
                    cover,
                    bucket,
                    f"{path}/{cover_filename}",
                    ExtraArgs={"Metadata": {"image-width": str(width),
                                            "image-height": str(height),
                                            "cover-image": "Yes"},
                               "ContentType": "image/jpeg"}
                )
                os.remove(cover)

            os.remove(download_path)

    except Exception as e:
        import traceback
        log.error(traceback.format_exc())
        log.error(f"Lambda Exception: {e}")
