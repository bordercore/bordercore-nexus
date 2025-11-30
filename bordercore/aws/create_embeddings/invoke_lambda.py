"""Script to invoke the CreateEmbeddings Lambda function.

This module provides a command-line script to manually trigger the AWS Lambda
function that creates embeddings for blob content or arbitrary text. It can
invoke the function asynchronously for blob UUIDs or synchronously for text.
"""

import argparse
import json
import sys
from uuid import UUID

import boto3

import django

django.setup()


client = boto3.client("lambda")


def invoke(uuid: str | UUID | None, text: str | None) -> None:
    """Invoke the CreateEmbeddings Lambda function.

    Invokes the Lambda function either asynchronously for a blob UUID or
    synchronously for text content. The function creates embeddings using
    the configured embedding model.

    Args:
        uuid: Optional UUID string or UUID object identifying the blob to
            process. If provided, invokes asynchronously.
        text: Optional text string to create embeddings for. If provided,
            invokes synchronously and prints the response.
    """

    args = {
        "FunctionName": "CreateEmbeddings",
        "LogType": "Tail",
    }

    if uuid:
        payload: dict[str, str | UUID] = {
            "uuid": uuid
        }
        args["InvocationType"] = "Event"
    else:
        if text is None:
            raise ValueError("Either uuid or text must be provided")
        payload = {
            "text": text
        }
        args["InvocationType"] = "RequestResponse"

    args["Payload"] = json.dumps(payload)

    response = client.invoke(**args)

    print(response["Payload"].read())


if __name__ == "__main__":

    parser = argparse.ArgumentParser()
    parser.add_argument("--uuid", "-u", type=str,
                        help="the uuid of the blob")
    parser.add_argument("--text", "-t", type=str,
                        help="the text to create embeddings")

    args = parser.parse_args()

    uuid = args.uuid
    text = args.text

    if not uuid and not text:
        print("Please provide either a uuid or text")
        sys.exit(1)

    invoke(uuid, text)
