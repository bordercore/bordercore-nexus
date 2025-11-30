"""Script to invoke the IndexBlob Lambda function.

This module provides a command-line script to manually trigger the AWS Lambda
function that indexes blob content in Elasticsearch. It constructs an S3
event payload and invokes the Lambda function asynchronously.
"""

import argparse
import json
import pprint
from uuid import UUID

import boto3

import django

django.setup()

client = boto3.client("lambda")


def invoke(uuid: str | UUID, file_changed: bool) -> None:
    """Invoke the IndexBlob Lambda function for a blob.

    Constructs an S3 event payload simulating an object creation event and
    invokes the Lambda function asynchronously to index the blob content
    in Elasticsearch.

    Args:
        uuid: UUID string or UUID object identifying the blob to index.
        file_changed: If True, indicates the file content has changed and
            should be re-indexed. If False, only metadata is updated.
    """

    message = {
        "Records": [
            {
                "eventName": "ObjectCreated: Put",
                "s3": {
                    "bucket": {
                        "name": "bordercore-blobs",
                    },
                    "file_changed": file_changed,
                    "uuid": str(uuid)
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
        FunctionName="IndexBlob",
        InvocationType="Event",
        LogType="Tail",
        Payload=json.dumps(payload)
    )

    pprint.PrettyPrinter(indent=4).pprint(response)


if __name__ == "__main__":

    parser = argparse.ArgumentParser()
    parser.add_argument("--file_changed", "-f", default=False,
                        help="force re-indexing of the contents of the blob",
                        action="store_true")
    parser.add_argument("--uuid", "-u", type=str, required=True,
                        help="the uuid of the blob to index")

    args = parser.parse_args()

    file_changed = args.file_changed
    uuid = args.uuid

    invoke(uuid, file_changed)
