"""AWS Lambda function for creating collection thumbnails.

This module provides an AWS Lambda handler that creates thumbnail images for
collections by downloading images from collection members, combining them into
a single cover image, and uploading the result to S3.
"""

import json
import logging
import os
import subprocess
from typing import Any
from uuid import UUID

import boto3
import requests

from lib.util import is_image, is_pdf

logging.getLogger().setLevel(logging.INFO)
log = logging.getLogger(__name__)

EFS_DIR = os.environ.get("EFS_DIR", "/tmp")
DRF_TOKEN = os.environ.get("DRF_TOKEN")
S3_BUCKET_NAME = "bordercore-blobs"

s3_client = boto3.client("s3")


def download_images_from_collection(collection_uuid: str | UUID) -> list[str]:
    """Download images from collection members for thumbnail creation.

    Retrieves the list of images in a collection from the API, downloads
    PDF cover images or image files from S3, and returns a list of local
    filenames for processing.

    Args:
        collection_uuid: UUID string or UUID object identifying the collection.

    Returns:
        List of local filenames for downloaded images.

    Raises:
        Exception: If the API request fails or returns a non-200 status code.
    """

    headers = {"Authorization": f"Token {DRF_TOKEN}"}
    r = requests.get(f"https://www.bordercore.com/api/collections/images/{collection_uuid}/", headers=headers, timeout=10)
    if r.status_code != 200:
        raise Exception(f"Error: status code: {r.status_code}")

    object_list = r.json()
    log.info(object_list)

    filenames = []

    for object in object_list:

        if is_pdf(object["filename"]):
            # For pdfs, download the cover image
            s3_key = "cover-large.jpg"
        elif is_image(object["filename"]):
            # For images, download the image itself
            s3_key = object["filename"]
        else:
            # If it's any other type, skip
            continue

        # Prepend the object's uuid to insure uniqueness
        filename = f"{object['uuid']}-{s3_key}"
        filenames.append(filename)

        file_path = f"{EFS_DIR}/collections/{filename}"
        s3_client.download_file(S3_BUCKET_NAME, f"blobs/{object['uuid']}/{s3_key}", file_path)

    return filenames


def handler(event: dict[str, Any], context: Any) -> None:
    """AWS Lambda handler for creating collection thumbnails.

    Processes SNS events containing collection UUIDs, downloads images from
    collection members, combines them into a thumbnail using a shell script,
    and uploads the result to S3.

    Args:
        event: Lambda event dictionary containing SNS records with collection UUIDs.
        context: Lambda context object (unused but required by Lambda interface).
    """

    try:

        for record in event["Records"]:

            sns_record = json.loads(record["Sns"]["Message"])["Records"][0]

            collection_uuid = sns_record["s3"].get("collection_uuid")

            log.info(f"Creating cover image for collection_uuid: {collection_uuid}")

            thumbnail_filename = f"{collection_uuid}.jpg"

            object_list = download_images_from_collection(collection_uuid)

            if object_list:
                result = subprocess.run(
                    [
                        "sh",
                        "create-cover.sh",
                        collection_uuid,
                        *object_list
                    ],
                    capture_output=True
                )

                log.info(f"create-cover.sh result: {result}")

                # Upload the resulting thumbnail back to S3
                s3_client.upload_file(
                    f"{EFS_DIR}/collections/{thumbnail_filename}",
                    S3_BUCKET_NAME,
                    f"collections/{thumbnail_filename}",
                    ExtraArgs={"ContentType": "image/jpeg"}
                )

                # Delete the sample images once done
                for object in object_list:
                    os.remove(f"{EFS_DIR}/collections/{object}")

                os.remove(f"{EFS_DIR}/collections/{thumbnail_filename}")

        log.info("Lambda finished")

    except Exception as e:
        log.error(f"{type(e)} exception: {e}")
        log.error(sns_record)
        import traceback
        print(traceback.format_exc())
