"""Tests for lib.aws — thin boto3 wrapper functions."""

import json
from io import BytesIO
from unittest.mock import patch, MagicMock

import boto3
import pytest
try:
    from moto import mock_aws
except (ModuleNotFoundError, NameError):
    # Don't worry if these imports don't exist in production
    pass

from lib.aws import (
    lambda_invoke_async,
    s3_copy_object,
    s3_delete_object,
    s3_delete_objects_by_prefix,
    s3_download_fileobj,
    s3_list_objects,
    s3_put_object,
    s3_update_metadata,
    s3_upload_fileobj,
    sns_publish,
)

BUCKET = "test-aws-helpers-bucket"


@pytest.fixture(autouse=True)
def _reset_module_singletons():
    """Clear the module-level cached clients between tests."""
    import lib.aws as mod
    mod._s3_client = None
    mod._s3_resource = None
    mod._sns_client = None
    mod._lambda_client = None


@pytest.fixture()
def aws_env(monkeypatch):
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SECURITY_TOKEN", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")


@pytest.fixture()
def s3(aws_env):
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        # Clean up bucket from previous tests (session-scoped mock_aws
        # makes nested contexts share state)
        try:
            resp = client.list_objects_v2(Bucket=BUCKET)
            if "Contents" in resp:
                client.delete_objects(
                    Bucket=BUCKET,
                    Delete={"Objects": [{"Key": o["Key"]} for o in resp["Contents"]]},
                )
            client.delete_bucket(Bucket=BUCKET)
        except client.exceptions.NoSuchBucket:
            pass
        client.create_bucket(Bucket=BUCKET)
        yield client


# ---- S3 upload / download / put ----

def test_s3_upload_fileobj(s3):
    """Test that s3_upload_fileobj uploads a file with content type and metadata."""
    buf = BytesIO(b"hello world")
    s3_upload_fileobj(buf, BUCKET, "dir/file.txt", content_type="text/plain", metadata={"foo": "bar"})

    obj = s3.get_object(Bucket=BUCKET, Key="dir/file.txt")
    assert obj["Body"].read() == b"hello world"
    assert obj["ContentType"] == "text/plain"
    assert obj["Metadata"]["foo"] == "bar"


def test_s3_upload_fileobj_minimal(s3):
    """Test that s3_upload_fileobj works with only required arguments."""
    buf = BytesIO(b"data")
    s3_upload_fileobj(buf, BUCKET, "simple.bin")

    obj = s3.get_object(Bucket=BUCKET, Key="simple.bin")
    assert obj["Body"].read() == b"data"


def test_s3_put_object(s3):
    """Test that s3_put_object stores an object with content type, metadata, cache control, and ACL."""
    s3_put_object(
        BUCKET, "put/key.json", b'{"a":1}',
        content_type="application/json",
        metadata={"m": "v"},
        cache_control="max-age=100",
        acl="public-read",
    )
    obj = s3.get_object(Bucket=BUCKET, Key="put/key.json")
    assert obj["Body"].read() == b'{"a":1}'
    assert obj["ContentType"] == "application/json"
    assert obj["Metadata"]["m"] == "v"
    assert obj["CacheControl"] == "max-age=100"


def test_s3_download_fileobj(s3):
    """Test that s3_download_fileobj downloads an object and returns its content."""
    s3.put_object(Bucket=BUCKET, Key="dl.txt", Body=b"content")
    buf = s3_download_fileobj(BUCKET, "dl.txt")
    assert buf.read() == b"content"


# ---- S3 delete ----

def test_s3_delete_object(s3):
    """Test that s3_delete_object removes an object from S3."""
    s3.put_object(Bucket=BUCKET, Key="to-del.txt", Body=b"x")
    s3_delete_object(BUCKET, "to-del.txt")
    with pytest.raises(s3.exceptions.NoSuchKey):
        s3.get_object(Bucket=BUCKET, Key="to-del.txt")


def test_s3_delete_objects_by_prefix(s3):
    """Test that s3_delete_objects_by_prefix removes all objects under a prefix."""
    for i in range(3):
        s3.put_object(Bucket=BUCKET, Key=f"prefix/{i}.txt", Body=b"x")
    s3.put_object(Bucket=BUCKET, Key="other/keep.txt", Body=b"keep")

    s3_delete_objects_by_prefix(BUCKET, "prefix/")

    resp = s3.list_objects_v2(Bucket=BUCKET)
    remaining = [o["Key"] for o in resp.get("Contents", [])]
    assert remaining == ["other/keep.txt"]


# ---- S3 copy ----

def test_s3_copy_object(s3):
    """Test that s3_copy_object copies an object to a new key while keeping the original."""
    s3.put_object(Bucket=BUCKET, Key="src.txt", Body=b"copy-me")
    s3_copy_object(BUCKET, "src.txt", "dst.txt")

    obj = s3.get_object(Bucket=BUCKET, Key="dst.txt")
    assert obj["Body"].read() == b"copy-me"
    # source still exists
    s3.get_object(Bucket=BUCKET, Key="src.txt")


# ---- S3 metadata ----

def test_s3_update_metadata(s3):
    """Test that s3_update_metadata updates custom metadata on an existing S3 object."""
    s3.put_object(Bucket=BUCKET, Key="meta.txt", Body=b"x", ContentType="text/plain")
    s3_update_metadata(BUCKET, "meta.txt", {"custom": "val"}, "text/plain")

    head = s3.head_object(Bucket=BUCKET, Key="meta.txt")
    assert head["Metadata"]["custom"] == "val"
    assert head["ContentType"] == "text/plain"


# ---- S3 list ----

def test_s3_list_objects(s3):
    """Test that s3_list_objects returns keys matching a given prefix."""
    for name in ["a.txt", "b.txt", "c.txt"]:
        s3.put_object(Bucket=BUCKET, Key=f"list/{name}", Body=b"x")
    s3.put_object(Bucket=BUCKET, Key="other.txt", Body=b"y")

    keys = s3_list_objects(BUCKET, "list/")
    assert set(keys) == {"list/a.txt", "list/b.txt", "list/c.txt"}


def test_s3_list_objects_empty(s3):
    """Test that s3_list_objects returns an empty list for a nonexistent prefix."""
    assert s3_list_objects(BUCKET, "nonexistent/") == []


# ---- SNS ----

def test_sns_publish(aws_env):
    """Test that sns_publish sends a message to an SNS topic without raising."""
    with mock_aws():
        sns = boto3.client("sns", region_name="us-east-1")
        topic = sns.create_topic(Name="test-topic")
        topic_arn = topic["TopicArn"]

        # Should not raise
        sns_publish(topic_arn, {"key": "value"})


# ---- Lambda ----

def test_lambda_invoke_async():
    """Test that lambda_invoke_async invokes a Lambda function asynchronously with the correct payload."""
    with patch("lib.aws.boto3.client") as mock_client_ctor:
        mock_lambda = MagicMock()
        mock_client_ctor.return_value = mock_lambda

        lambda_invoke_async("MyFunc", {"data": 123})

        mock_lambda.invoke.assert_called_once_with(
            FunctionName="MyFunc",
            InvocationType="Event",
            Payload=json.dumps({"data": 123}),
        )
