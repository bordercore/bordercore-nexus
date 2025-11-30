"""AWS Lambda function for indexing blob content in Elasticsearch.

This module provides an AWS Lambda handler that processes S3 events or direct
invocations to index blob content in Elasticsearch. It extracts blob UUIDs
from S3 keys or event payloads and triggers indexing operations.
"""

import json
import logging
import os
import re
from pathlib import PurePath
from typing import Any

import boto3
from requests_aws4auth import AWS4Auth

from lib.elasticsearch_indexer import index_blob as index_blob_es

logging.getLogger().setLevel(logging.INFO)
log = logging.getLogger(__name__)

credentials = boto3.Session().get_credentials()
awsauth = AWS4Auth(credentials.access_key, credentials.secret_key, os.environ["AWS_REGION"], "es", session_token=credentials.token)


def handler(event: dict[str, Any], context: Any) -> None:
    """AWS Lambda handler for indexing blobs in Elasticsearch.

    Processes SNS events containing S3 object creation events or direct
    invocations with blob UUIDs. Extracts UUIDs from S3 keys or event
    payloads, indexes blob content in Elasticsearch, and optionally
    triggers embedding creation.

    Args:
        event: Lambda event dictionary containing SNS records with S3 events
            or direct invocation payloads.
        context: Lambda context object (unused but required by Lambda interface).
    """

    try:

        for record in event["Records"]:

            sns_record = json.loads(record["Sns"]["Message"])["Records"][0]

            # Ignore object delete events
            if sns_record.get("eventName", None) == "ObjectRemoved:DeleteMarkerCreated":
                continue

            file_changed = sns_record["s3"].get("file_changed", True)
            new_blob = sns_record["s3"].get("new_blob", True)
            uuid = None

            # If this was triggered by S3, then parse the uuid from the S3 key.
            # Otherwise this must have been called from Django, in which case the
            # uuid was passed in directly instead.
            if "object" in sns_record["s3"]:

                key = sns_record["s3"]["object"]["key"]
                log.info(f"Lambda triggered by S3, key: {key}")

                # blobs/af351cc4-3b8b-47d5-8048-85e5fb5abe19/cover.jpg
                pattern = re.compile(r"^blobs/(.*?)/")

                matches = pattern.match(key)
                if matches and matches.group(1):
                    uuid = matches.group(1)
                else:
                    # TODO Throw more specific exception
                    raise Exception(f"Can't parse uuid from key: {key}")

                if PurePath(key).name == "cover.jpg" or PurePath(key).name.startswith("cover-"):
                    log.info("Not indexing cover image.")
                    continue

            else:
                uuid = sns_record["s3"]["uuid"]
                if uuid is None:
                    raise Exception(f"No uuid found in SNS event: {record['Sns']['Message']}")
                log.info(f"Lambda triggered by Django, uuid: {uuid}")

            index_blob_es(uuid=uuid, file_changed=file_changed, new_blob=new_blob)

            if uuid:
                client = boto3.client("lambda")
                client.invoke(
                    FunctionName="arn:aws:lambda:us-east-1:192218769908:function:CreateEmbeddings",
                    InvocationType="Event",
                    Payload=json.dumps({"uuid": uuid})
                )

        log.info("Lambda finished")

    except Exception as e:
        log.error(f"{type(e)} exception: {e}")
        log.error(sns_record)
        import traceback
        print(traceback.format_exc())
