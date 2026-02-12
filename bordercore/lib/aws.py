"""Thin wrappers around AWS boto3 calls (S3, SNS, Lambda).

All direct boto3 usage outside of management commands, the ``bordercore/aws/``
invoke scripts, ``blob/elasticsearch_indexer.py``, and the
``DownloadableS3Boto3Storage`` class should go through these helpers so that
the rest of the codebase never imports ``boto3`` directly.
"""

import json
import logging
from io import BytesIO
from typing import Any

import boto3

log = logging.getLogger(f"bordercore.{__name__}")

# ---------------------------------------------------------------------------
# S3
# ---------------------------------------------------------------------------

_s3_client = None
_s3_resource = None


def _get_s3_client() -> Any:
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client("s3")
    return _s3_client


def _get_s3_resource() -> Any:
    global _s3_resource
    if _s3_resource is None:
        _s3_resource = boto3.resource("s3")
    return _s3_resource


def s3_upload_fileobj(
    fileobj: Any,
    bucket: str,
    key: str,
    *,
    content_type: str | None = None,
    metadata: dict[str, str] | None = None,
    cache_control: str | None = None,
) -> None:
    """Upload a file-like object to S3.

    Args:
        fileobj: A file-like object to upload.
        bucket: The S3 bucket name.
        key: The S3 object key.
        content_type: Optional MIME type for the uploaded object.
        metadata: Optional dictionary of S3 object metadata.
        cache_control: Optional Cache-Control header value.
    """
    extra: dict[str, Any] = {}
    if content_type:
        extra["ContentType"] = content_type
    if metadata:
        extra["Metadata"] = metadata
    if cache_control:
        extra["CacheControl"] = cache_control

    kwargs: dict[str, Any] = {}
    if extra:
        kwargs["ExtraArgs"] = extra

    _get_s3_client().upload_fileobj(fileobj, bucket, key, **kwargs)


def s3_delete_object(bucket: str, key: str) -> None:
    """Delete a single object from S3.

    Args:
        bucket: The S3 bucket name.
        key: The S3 object key to delete.
    """
    _get_s3_client().delete_object(Bucket=bucket, Key=key)


def s3_delete_objects_by_prefix(bucket: str, prefix: str) -> None:
    """List all objects under *prefix* and delete them in batch.

    Args:
        bucket: The S3 bucket name.
        prefix: The key prefix to match objects for deletion.
    """
    s3 = _get_s3_resource()
    bucket_obj = s3.Bucket(bucket)
    for obj in bucket_obj.objects.filter(Prefix=prefix):
        log.info("Deleting S3 object %s", obj.key)
        obj.delete()


def s3_copy_object(bucket: str, source_key: str, dest_key: str) -> None:
    """Copy an S3 object within the same bucket.

    Args:
        bucket: The S3 bucket name.
        source_key: The key of the object to copy from.
        dest_key: The key to copy the object to.
    """
    _get_s3_resource().Object(bucket, dest_key).copy_from(
        CopySource=f"{bucket}/{source_key}"
    )


def s3_download_fileobj(bucket: str, key: str) -> BytesIO:
    """Download an S3 object into a BytesIO buffer and return it.

    Args:
        bucket: The S3 bucket name.
        key: The S3 object key to download.

    Returns:
        A BytesIO buffer containing the downloaded object data, seeked to
        the beginning.
    """
    buf = BytesIO()
    _get_s3_client().download_fileobj(bucket, key, buf)
    buf.seek(0)
    return buf


def s3_update_metadata(
    bucket: str,
    key: str,
    metadata: dict[str, str],
    content_type: str,
) -> None:
    """Replace an S3 object's metadata via copy-in-place.

    Merges new metadata with any existing metadata on the object.
    Content-Type must be explicitly preserved; otherwise S3 resets it to
    ``binary/octet-stream``.

    Args:
        bucket: The S3 bucket name.
        key: The S3 object key to update.
        metadata: Dictionary of metadata key-value pairs to set.
        content_type: The Content-Type to preserve on the object.
    """
    s3_obj = _get_s3_resource().Object(bucket, key)
    # Merge new metadata with any existing metadata
    existing = dict(s3_obj.metadata or {})
    existing.update(metadata)
    s3_obj.copy_from(
        ContentType=content_type,
        CopySource={"Bucket": bucket, "Key": key},
        Metadata=existing,
        MetadataDirective="REPLACE",
    )


def s3_list_objects(bucket: str, prefix: str) -> list[str]:
    """Return all object keys under *prefix* using paginated listing.

    Args:
        bucket: The S3 bucket name.
        prefix: The key prefix to list objects under.

    Returns:
        List of S3 object key strings matching the prefix.
    """
    client = _get_s3_client()
    paginator = client.get_paginator("list_objects_v2")
    keys: list[str] = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    return keys


def s3_put_object(
    bucket: str,
    key: str,
    body: bytes,
    *,
    content_type: str | None = None,
    metadata: dict[str, str] | None = None,
    cache_control: str | None = None,
    acl: str | None = None,
) -> None:
    """Put (upload) bytes directly to an S3 key.

    Args:
        bucket: The S3 bucket name.
        key: The S3 object key.
        body: The raw bytes to upload.
        content_type: Optional MIME type for the uploaded object.
        metadata: Optional dictionary of S3 object metadata.
        cache_control: Optional Cache-Control header value.
        acl: Optional canned ACL (e.g. ``"public-read"``).
    """
    kwargs: dict[str, Any] = {"Bucket": bucket, "Key": key, "Body": body}
    if content_type:
        kwargs["ContentType"] = content_type
    if metadata:
        kwargs["Metadata"] = metadata
    if cache_control:
        kwargs["CacheControl"] = cache_control
    if acl:
        kwargs["ACL"] = acl
    _get_s3_client().put_object(**kwargs)


# ---------------------------------------------------------------------------
# SNS
# ---------------------------------------------------------------------------

def sns_publish(topic_arn: str, message: dict[str, Any]) -> None:
    """Publish a JSON-serialised message to an SNS topic.

    Args:
        topic_arn: The ARN of the SNS topic to publish to.
        message: Dictionary payload that will be JSON-serialised.
    """
    client = boto3.client("sns")
    client.publish(TopicArn=topic_arn, Message=json.dumps(message))


# ---------------------------------------------------------------------------
# Lambda
# ---------------------------------------------------------------------------

def lambda_invoke_async(function_name: str, payload: dict[str, Any]) -> None:
    """Invoke a Lambda function asynchronously (fire-and-forget).

    Args:
        function_name: The name of the Lambda function to invoke.
        payload: Dictionary payload that will be JSON-serialised and sent
            to the function.
    """
    client = boto3.client("lambda")
    client.invoke(
        FunctionName=function_name,
        InvocationType="Event",
        Payload=json.dumps(payload),
    )
