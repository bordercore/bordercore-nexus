"""Script to invoke the UpdateFeeds Lambda function.

This module provides a command-line script to manually trigger the AWS Lambda
function that updates RSS/Atom feeds. It invokes the Lambda function
asynchronously to fetch and process feed content.
"""

import argparse
import json
import pprint
from uuid import UUID

import boto3

import django

django.setup()


client = boto3.client("lambda")


def invoke(uuid: str | UUID) -> None:
    """Invoke the UpdateFeeds Lambda function for a feed.

    Invokes the Lambda function asynchronously to fetch and update the
    specified RSS/Atom feed, processing new entries and storing them.

    Args:
        uuid: UUID string or UUID object identifying the feed to update.
    """

    payload = {
        "feed_uuid": uuid
    }

    response = client.invoke(
        ClientContext="MyApp",
        FunctionName="UpdateFeeds",
        InvocationType="Event",
        LogType="Tail",
        Payload=json.dumps(payload)
    )

    pprint.PrettyPrinter(indent=4).pprint(response)


if __name__ == "__main__":

    parser = argparse.ArgumentParser()
    parser.add_argument("--uuid", "-u", type=str, required=True,
                        help="the feed uuid to update")

    args = parser.parse_args()

    uuid = args.uuid

    invoke(uuid)
