"""Tests for thumbnail_fetcher and elasticsearch_writer helpers."""
import sys
from types import ModuleType
from unittest.mock import MagicMock, patch

import numpy as np

# Stub out boto3 so lib.thumbnail_fetcher can be imported without the real SDK.
_boto3_stub = ModuleType("boto3")
sys.modules.setdefault("boto3", _boto3_stub)

# Pre-import the submodules so @patch can resolve them as lib.<name> attributes.
import lib.thumbnail_fetcher  # noqa: E402, F401
import lib.elasticsearch_writer  # noqa: E402, F401


@patch("lib.thumbnail_fetcher.boto3")
def test_fetch_thumbnail_reads_from_correct_s3_key(mock_boto3):
    """fetch_thumbnail downloads from the expected S3 key path."""
    from lib.thumbnail_fetcher import fetch_thumbnail

    body = MagicMock()
    body.read.return_value = b"\x89PNG..."
    mock_boto3.client.return_value.get_object.return_value = {"Body": body}

    data = fetch_thumbnail("abc-123-uuid", bucket="my-bucket")

    assert data == b"\x89PNG..."
    mock_boto3.client.return_value.get_object.assert_called_once_with(
        Bucket="my-bucket", Key="blobs/abc-123-uuid/cover.jpg"
    )


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
