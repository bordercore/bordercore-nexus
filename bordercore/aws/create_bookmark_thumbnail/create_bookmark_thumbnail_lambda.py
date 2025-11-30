"""AWS Lambda function for creating bookmark thumbnails.

This module provides an AWS Lambda handler that processes S3 object creation
events to generate thumbnail images for bookmark images. It downloads images
from S3, creates thumbnails using the thumbnail service, and uploads them
back to S3 with appropriate metadata.
"""

import logging
import os
from pathlib import Path, PurePath
from typing import Any
from urllib.parse import unquote_plus

import boto3
from PIL import Image

from lib.thumbnails import create_bookmark_thumbnail

logging.getLogger().setLevel(logging.INFO)
log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)

s3_client = boto3.client("s3")

EFS_DIR = Path(os.environ.get("EFS_DIR", "/tmp")) / "bookmarks"


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


def handler(event: dict[str, Any], context: Any) -> None:
    """AWS Lambda handler for processing S3 bookmark image uploads.

    Processes S3 object creation events to generate thumbnail images for
    bookmark images. Downloads images from S3, creates thumbnails, and
    uploads them back to S3 with metadata. Skips cover images and delete
    events.

    Args:
        event: Lambda event dictionary containing S3 event records.
        context: Lambda context object (unused but required by Lambda interface).
    """

    try:
        # Ensure EFS directory exists
        os.makedirs(EFS_DIR, exist_ok=True)

        for record in event["Records"]:
            bucket = record["s3"]["bucket"]["name"]

            # Ignore object delete events
            if record["eventName"] == "ObjectRemoved:Delete":
                continue

            # Spaces are replaced with '+'s
            key = unquote_plus(record["s3"]["object"]["key"])

            log.info(f"Creating thumbnail image for {key}")

            p = PurePath(key)
            path = p.parent
            filename = p.name

            if is_cover_image(bucket, key):
                log.info(f"Skipping cover image {filename}")
                continue

            download_path = EFS_DIR / filename
            s3_client.download_file(bucket, key, str(download_path))

            thumbnail_filename = f"{p.stem}-small.png"
            thumbnail_filepath = EFS_DIR / thumbnail_filename
            create_bookmark_thumbnail(str(download_path), str(thumbnail_filepath))

            # Upload thumbnail image to S3
            with Image.open(thumbnail_filepath) as img:
                width, height = img.size
            s3_key = PurePath(path) / thumbnail_filename
            s3_client.upload_file(
                str(thumbnail_filepath),
                bucket,
                str(s3_key),
                ExtraArgs={
                    "Metadata": {
                        "image-width": str(width),
                        "image-height": str(height),
                        "cover-image": "Yes"
                    },
                    "ContentType": "image/png"
                }
            )

            thumbnail_filepath.unlink()
            download_path.unlink()

    except Exception as e:
        import traceback
        log.error(traceback.format_exc())
        log.error(f"Lambda Exception: {e}")
        raise
