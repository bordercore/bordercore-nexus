"""Script to invoke the CreateCollectionThumbnail Lambda function.

This module provides a command-line script to manually trigger the AWS Lambda
function that creates thumbnail images for collections. It publishes a message
to SNS that triggers the Lambda function to generate a collection thumbnail.
"""

import argparse
import json
from uuid import UUID

import boto3

import django
from django.conf import settings

django.setup()

client = boto3.client("lambda")


def invoke(uuid: str | UUID) -> None:
    """Invoke the CreateCollectionThumbnail Lambda function for a collection.

    Publishes a message to SNS that triggers the Lambda function to create
    a thumbnail image for the specified collection by combining images from
    collection members.

    Args:
        uuid: UUID string or UUID object identifying the collection to process.
    """

    client = boto3.client("sns")

    message = {
        "Records": [
            {
                "s3": {
                    "bucket": {
                        "name": settings.AWS_STORAGE_BUCKET_NAME,
                    },
                    "collection_uuid": str(uuid)
                }
            }
        ]
    }

    client.publish(
        TopicArn=settings.CREATE_COLLECTION_THUMBNAIL_TOPIC_ARN,
        Message=json.dumps(message),
    )


if __name__ == "__main__":

    parser = argparse.ArgumentParser()
    parser.add_argument("--uuid", "-u", type=str, required=True,
                        help="the uuid of the collection")

    args = parser.parse_args()

    uuid = args.uuid

    invoke(uuid)
