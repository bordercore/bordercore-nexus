"""Tests for thumbnail_fetcher and elasticsearch_writer helpers."""
import sys
from types import ModuleType
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from botocore.exceptions import ClientError

# Stub out boto3 so lib.thumbnail_fetcher can be imported without the real SDK.
_boto3_stub = ModuleType("boto3")
sys.modules.setdefault("boto3", _boto3_stub)

# Pre-import the submodules so @patch can resolve them as lib.<name> attributes.
import lib.thumbnail_fetcher  # noqa: E402, F401
import lib.elasticsearch_writer  # noqa: E402, F401


def _body(data):
    """Build a fake S3 ``get_object`` response wrapping ``data``."""
    body = MagicMock()
    body.read.return_value = data
    return {"Body": body}


def _missing(code="NoSuchKey"):
    """Build a ClientError mimicking an absent S3 object."""
    return ClientError(
        {"Error": {"Code": code, "Message": "nope"}}, "GetObject"
    )


@patch("lib.thumbnail_fetcher.boto3")
def test_fetch_image_bytes_prefers_cover_thumbnail(mock_boto3):
    """When the cover thumbnail exists, it is returned without listing the bucket."""
    from lib.thumbnail_fetcher import fetch_image_bytes

    s3 = mock_boto3.client.return_value
    s3.get_object.return_value = _body(b"\x89PNG...")

    data = fetch_image_bytes("abc-123-uuid", bucket="my-bucket")

    assert data == b"\x89PNG..."
    s3.get_object.assert_called_once_with(
        Bucket="my-bucket", Key="blobs/abc-123-uuid/cover.jpg"
    )
    s3.list_objects_v2.assert_not_called()


@patch("lib.thumbnail_fetcher.boto3")
def test_fetch_image_bytes_falls_back_to_original(mock_boto3):
    """A missing cover thumbnail falls back to the original upload (race fix).

    Generated cover images under the prefix are skipped so the original
    uploaded file is the one encoded.
    """
    from lib.thumbnail_fetcher import fetch_image_bytes

    s3 = mock_boto3.client.return_value
    s3.get_object.side_effect = [_missing(), _body(b"ORIGINALJPEG")]
    s3.list_objects_v2.return_value = {
        "Contents": [
            {"Key": "blobs/abc-123-uuid/cover.jpg"},
            {"Key": "blobs/abc-123-uuid/cover-large.jpg"},
            {"Key": "blobs/abc-123-uuid/DCP_0496.JPG"},
        ]
    }

    data = fetch_image_bytes("abc-123-uuid", bucket="my-bucket")

    assert data == b"ORIGINALJPEG"
    s3.list_objects_v2.assert_called_once_with(
        Bucket="my-bucket", Prefix="blobs/abc-123-uuid/"
    )
    # Second get_object is for the original, not either cover image.
    assert s3.get_object.call_args_list[-1].kwargs["Key"] == (
        "blobs/abc-123-uuid/DCP_0496.JPG"
    )


@patch("lib.thumbnail_fetcher.boto3")
def test_fetch_image_bytes_access_denied_triggers_fallback(mock_boto3):
    """AccessDenied (a 404 masked without s3:ListBucket) also falls back."""
    from lib.thumbnail_fetcher import fetch_image_bytes

    s3 = mock_boto3.client.return_value
    s3.get_object.side_effect = [_missing("AccessDenied"), _body(b"ORIG")]
    s3.list_objects_v2.return_value = {
        "Contents": [{"Key": "blobs/u/photo.png"}]
    }

    assert fetch_image_bytes("u", bucket="b") == b"ORIG"


@patch("lib.thumbnail_fetcher.boto3")
def test_fetch_image_bytes_reraises_unexpected_client_error(mock_boto3):
    """A non-absence S3 error is not masked as a fallback."""
    from lib.thumbnail_fetcher import fetch_image_bytes

    s3 = mock_boto3.client.return_value
    s3.get_object.side_effect = _missing("InternalError")

    with pytest.raises(ClientError):
        fetch_image_bytes("u", bucket="b")
    s3.list_objects_v2.assert_not_called()


@patch("lib.thumbnail_fetcher.boto3")
def test_fetch_image_bytes_raises_when_nothing_found(mock_boto3):
    """No cover and no original under the prefix raises FileNotFoundError."""
    from lib.thumbnail_fetcher import fetch_image_bytes

    s3 = mock_boto3.client.return_value
    s3.get_object.side_effect = _missing()
    s3.list_objects_v2.return_value = {
        "Contents": [{"Key": "blobs/u/cover.jpg"}]  # only a generated cover
    }

    with pytest.raises(FileNotFoundError):
        fetch_image_bytes("u", bucket="b")


@patch("lib.elasticsearch_writer.requests")
def test_store_image_embedding_posts_painless_update(mock_requests):
    """store_image_embedding sends a Painless script update to the correct ES URL."""
    from lib.elasticsearch_writer import store_image_embedding

    mock_requests.post.return_value.status_code = 200
    vec = np.array([0.1, 0.2, 0.3] * 170 + [0.4, 0.5], dtype=np.float32)
    store_image_embedding(
        "abc-123-uuid", vec, host="es.example", index="bordercore"
    )

    args, kwargs = mock_requests.post.call_args
    url = args[0]
    assert url == "http://es.example:9200/bordercore/_update/abc-123-uuid"
    body = kwargs["json"]
    assert body["script"]["source"] == (
        "ctx._source.image_embedding = params.value"
    )
    assert body["script"]["params"]["value"] == vec.tolist()
