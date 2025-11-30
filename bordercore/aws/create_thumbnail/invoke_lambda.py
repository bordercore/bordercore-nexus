"""Script to invoke the CreateThumbnail Lambda function.

This module provides a command-line script to manually trigger the AWS Lambda
function that creates thumbnail images for blobs. It constructs an S3 event
payload and invokes the Lambda function asynchronously.
"""

import argparse
import json
import pprint
from uuid import UUID

import boto3

import django
from django.conf import settings

django.setup()

from blob.models import Blob  # isort:skip

client = boto3.client("lambda")


def invoke(uuid: str | UUID) -> None:
    """Invoke the CreateThumbnail Lambda function for a blob.

    Retrieves the blob by UUID, constructs an S3 event payload simulating
    an object creation event, and invokes the Lambda function asynchronously
    to generate a thumbnail image.

    Args:
        uuid: UUID string or UUID object identifying the blob to process.
    """

    blob = Blob.objects.get(uuid=uuid)

    message = {
        "Records": [
            {
                "eventName": "ObjectCreated: Put",
                "s3": {
                    "bucket": {
                        "name": settings.AWS_STORAGE_BUCKET_NAME,
                    },
                    "object": {
                        "key": f"blobs/{blob.uuid}/{blob.file}"
                    }
                }
            }
        ]
    }

    payload = {
        "Records": [
            {
                "Sns": {
                    "Message": json.dumps(message)
                }
            }
        ]
    }

    response = client.invoke(
        ClientContext="MyApp",
        FunctionName="CreateThumbnail",
        InvocationType="Event",
        LogType="Tail",
        Payload=json.dumps(payload)
    )

    pprint.PrettyPrinter(indent=4).pprint(response)


if __name__ == "__main__":

    parser = argparse.ArgumentParser()
    parser.add_argument("--uuid", "-u", type=str, required=True,
                        help="the uuid of the blob to index")

    args = parser.parse_args()

    uuid = args.uuid

    invoke(uuid)
