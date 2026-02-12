"""Tests for lib.aws — thin boto3 wrapper functions."""

import json
from io import BytesIO
from unittest.mock import patch, MagicMock

import boto3
import pytest
from moto import mock_aws

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
        client.create_bucket(Bucket=BUCKET)
        yield client


# ---- S3 upload / download / put ----

def test_s3_upload_fileobj(s3):
    buf = BytesIO(b"hello world")
    s3_upload_fileobj(buf, BUCKET, "dir/file.txt", content_type="text/plain", metadata={"foo": "bar"})

    obj = s3.get_object(Bucket=BUCKET, Key="dir/file.txt")
    assert obj["Body"].read() == b"hello world"
    assert obj["ContentType"] == "text/plain"
    assert obj["Metadata"]["foo"] == "bar"


def test_s3_upload_fileobj_minimal(s3):
    buf = BytesIO(b"data")
    s3_upload_fileobj(buf, BUCKET, "simple.bin")

    obj = s3.get_object(Bucket=BUCKET, Key="simple.bin")
    assert obj["Body"].read() == b"data"


def test_s3_put_object(s3):
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
    s3.put_object(Bucket=BUCKET, Key="dl.txt", Body=b"content")
    buf = s3_download_fileobj(BUCKET, "dl.txt")
    assert buf.read() == b"content"


# ---- S3 delete ----

def test_s3_delete_object(s3):
    s3.put_object(Bucket=BUCKET, Key="to-del.txt", Body=b"x")
    s3_delete_object(BUCKET, "to-del.txt")
    with pytest.raises(s3.exceptions.NoSuchKey):
        s3.get_object(Bucket=BUCKET, Key="to-del.txt")


def test_s3_delete_objects_by_prefix(s3):
    for i in range(3):
        s3.put_object(Bucket=BUCKET, Key=f"prefix/{i}.txt", Body=b"x")
    s3.put_object(Bucket=BUCKET, Key="other/keep.txt", Body=b"keep")

    s3_delete_objects_by_prefix(BUCKET, "prefix/")

    resp = s3.list_objects_v2(Bucket=BUCKET)
    remaining = [o["Key"] for o in resp.get("Contents", [])]
    assert remaining == ["other/keep.txt"]


# ---- S3 copy ----

def test_s3_copy_object(s3):
    s3.put_object(Bucket=BUCKET, Key="src.txt", Body=b"copy-me")
    s3_copy_object(BUCKET, "src.txt", "dst.txt")

    obj = s3.get_object(Bucket=BUCKET, Key="dst.txt")
    assert obj["Body"].read() == b"copy-me"
    # source still exists
    s3.get_object(Bucket=BUCKET, Key="src.txt")


# ---- S3 metadata ----

def test_s3_update_metadata(s3):
    s3.put_object(Bucket=BUCKET, Key="meta.txt", Body=b"x", ContentType="text/plain")
    s3_update_metadata(BUCKET, "meta.txt", {"custom": "val"}, "text/plain")

    head = s3.head_object(Bucket=BUCKET, Key="meta.txt")
    assert head["Metadata"]["custom"] == "val"
    assert head["ContentType"] == "text/plain"


# ---- S3 list ----

def test_s3_list_objects(s3):
    for name in ["a.txt", "b.txt", "c.txt"]:
        s3.put_object(Bucket=BUCKET, Key=f"list/{name}", Body=b"x")
    s3.put_object(Bucket=BUCKET, Key="other.txt", Body=b"y")

    keys = s3_list_objects(BUCKET, "list/")
    assert set(keys) == {"list/a.txt", "list/b.txt", "list/c.txt"}


def test_s3_list_objects_empty(s3):
    assert s3_list_objects(BUCKET, "nonexistent/") == []


# ---- SNS ----

def test_sns_publish(aws_env):
    with mock_aws():
        sns = boto3.client("sns", region_name="us-east-1")
        topic = sns.create_topic(Name="test-topic")
        topic_arn = topic["TopicArn"]

        # Should not raise
        sns_publish(topic_arn, {"key": "value"})


# ---- Lambda ----

def test_lambda_invoke_async():
    with patch("lib.aws.boto3.client") as mock_client_ctor:
        mock_lambda = MagicMock()
        mock_client_ctor.return_value = mock_lambda

        lambda_invoke_async("MyFunc", {"data": 123})

        mock_lambda.invoke.assert_called_once_with(
            FunctionName="MyFunc",
            InvocationType="Event",
            Payload=json.dumps({"data": 123}),
        )
