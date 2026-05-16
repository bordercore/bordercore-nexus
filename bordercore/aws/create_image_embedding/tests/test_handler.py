"""Tests for the CreateImageEmbedding Lambda handler routing."""
import base64
import sys
from types import ModuleType
from unittest.mock import patch

import numpy as np

# Stub out boto3 so lib.thumbnail_fetcher can be imported without the real SDK.
sys.modules.setdefault("boto3", ModuleType("boto3"))


@patch("create_image_embedding_lambda.store_image_embedding")
@patch("create_image_embedding_lambda.encode_image")
@patch("create_image_embedding_lambda.fetch_thumbnail")
def test_index_mode_fetches_encodes_stores(mock_fetch, mock_encode, mock_store):
    from create_image_embedding_lambda import handler

    mock_fetch.return_value = b"PNGDATA"
    mock_encode.return_value = np.zeros(512, dtype=np.float32)

    result = handler({"mode": "index", "uuid": "abc-uuid"}, None)

    mock_fetch.assert_called_once()
    mock_encode.assert_called_once_with(b"PNGDATA")
    mock_store.assert_called_once()
    assert result is None


@patch("create_image_embedding_lambda.encode_image")
def test_query_image_mode_returns_vector(mock_encode):
    from create_image_embedding_lambda import handler

    mock_encode.return_value = np.array([0.1] * 512, dtype=np.float32)
    payload = base64.b64encode(b"PNGDATA").decode("ascii")

    result = handler({"mode": "query_image", "image_b64": payload}, None)

    assert isinstance(result, dict)
    assert len(result["vector"]) == 512


@patch("create_image_embedding_lambda.encode_text")
def test_query_text_mode_returns_vector(mock_encode):
    from create_image_embedding_lambda import handler

    mock_encode.return_value = np.array([0.2] * 512, dtype=np.float32)

    result = handler({"mode": "query_text", "text": "a cat"}, None)

    assert isinstance(result, dict)
    assert len(result["vector"]) == 512
    mock_encode.assert_called_once_with("a cat")


def test_unknown_mode_returns_error():
    from create_image_embedding_lambda import handler

    result = handler({"mode": "bogus"}, None)
    assert isinstance(result, dict)
    assert "error" in result
