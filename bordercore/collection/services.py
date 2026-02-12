"""Service functions for the collection app's AWS interactions."""

import logging

from django.conf import settings

from lib.aws import s3_delete_object, sns_publish

log = logging.getLogger(f"bordercore.{__name__}")


def delete_collection_thumbnail(uuid: str) -> None:
    """Delete a collection's cover thumbnail from S3.

    Args:
        uuid: The collection's UUID string.
    """
    s3_delete_object(settings.AWS_STORAGE_BUCKET_NAME, f"collections/{uuid}.jpg")


def publish_create_collection_thumbnail(uuid: str) -> None:
    """Publish an SNS message to trigger collection thumbnail generation.

    Args:
        uuid: The collection's UUID string.
    """
    message = {
        "Records": [
            {
                "s3": {
                    "bucket": {
                        "name": settings.AWS_STORAGE_BUCKET_NAME,
                    },
                    "collection_uuid": uuid,
                }
            }
        ]
    }
    sns_publish(settings.CREATE_COLLECTION_THUMBNAIL_TOPIC_ARN, message)
