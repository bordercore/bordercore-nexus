"""Script to invoke the CreateBookmarkThumbnail Lambda function.

This module provides a command-line script to manually trigger the AWS Lambda
function that creates thumbnail images for bookmarks. It constructs the
appropriate S3 event payload and invokes the Lambda function asynchronously.
"""

import argparse
import json
import pprint
from uuid import UUID

import boto3

import django

django.setup()

from bookmark.models import Bookmark  # isort:skip

client = boto3.client("lambda")


def invoke(uuid: str | UUID) -> None:
    """Invoke the CreateBookmarkThumbnail Lambda function for a bookmark.

    Retrieves the bookmark by UUID, constructs an S3 event payload simulating
    an object creation event, and invokes the Lambda function asynchronously
    to generate a thumbnail image.

    Args:
        uuid: UUID string or UUID object identifying the bookmark to process.
    """

    bookmark = Bookmark.objects.get(uuid=uuid)

    message = {
        "Records": [
            {
                "eventName": "ObjectCreated: Put",
                "s3": {
                    "bucket": {
                        "name": "bordercore-blobs",
                    },
                    "object": {
                        "key": f"bookmarks/{bookmark.uuid}.png"
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
        FunctionName="CreateBookmarkThumbnail",
        InvocationType="Event",
        LogType="Tail",
        Payload=json.dumps(payload)
    )

    pprint.PrettyPrinter(indent=4).pprint(response)


if __name__ == "__main__":

    parser = argparse.ArgumentParser()
    parser.add_argument("--uuid", "-u", type=str, required=True,
                        help="the uuid of the bookmark to index")

    args = parser.parse_args()

    uuid = args.uuid

    invoke(uuid)
