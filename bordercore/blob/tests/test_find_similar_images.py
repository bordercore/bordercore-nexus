"""Tests for find_similar_images service."""
from unittest.mock import patch

import pytest


@patch("blob.services.get_elasticsearch_connection")
@patch("blob.services.encode_text_query")
def test_find_by_text_calls_lambda_then_script_score(mock_encode, mock_get_es):
    """Text mode encodes via Lambda, runs a script_score query, and converts ES scores to similarity."""
    from blob.services import find_similar_images

    mock_encode.return_value = [0.1] * 512
    es = mock_get_es.return_value
    es.search.return_value = {
        "hits": {"hits": [
            {"_id": "uuid-1", "_score": 1.95},
            {"_id": "uuid-2", "_score": 1.83},
        ]}
    }

    results = find_similar_images(user_id=42, text="sunset", threshold=0.5, limit=10)

    mock_encode.assert_called_once_with("sunset")
    body = es.search.call_args.kwargs["body"]
    # ES 7.x: script_score over a filtered base query
    script_score = body["query"]["script_score"]
    assert script_score["script"]["params"]["query_vector"] == [0.1] * 512
    assert "image_embedding" in script_score["script"]["source"]
    assert body["size"] == 10
    # Results converted from ES (1 + cos) range [0, 2] to similarity [0, 1]
    assert results == [("uuid-1", 0.975), ("uuid-2", 0.915)]


@patch("blob.services.get_elasticsearch_connection")
def test_find_by_blob_uuid_pulls_stored_vector(mock_get_es):
    """blob_uuid mode fetches the stored embedding from ES instead of calling the Lambda."""
    from blob.services import find_similar_images

    es = mock_get_es.return_value
    es.get.return_value = {"_source": {"image_embedding": [0.3] * 512}}
    es.search.return_value = {
        "hits": {"hits": [{"_id": "uuid-x", "_score": 2.0}]}
    }

    results = find_similar_images(user_id=42, blob_uuid="abc", threshold=0, limit=5)

    es.get.assert_called_once()
    body = es.search.call_args.kwargs["body"]
    assert body["query"]["script_score"]["script"]["params"]["query_vector"] == [0.3] * 512
    # Score 2.0 (== 1 + 1) -> similarity 1.0
    assert results == [("uuid-x", 1.0)]


@patch("blob.services.get_elasticsearch_connection")
@patch("blob.services.encode_image_query")
def test_find_by_image_bytes(mock_encode, mock_get_es):
    """image_bytes mode encodes the uploaded bytes via the Lambda and queries ES."""
    from blob.services import find_similar_images

    mock_encode.return_value = [0.2] * 512
    mock_get_es.return_value.search.return_value = {"hits": {"hits": []}}

    results = find_similar_images(user_id=42, image_bytes=b"PNG", threshold=0.9, limit=10)

    mock_encode.assert_called_once_with(b"PNG")
    assert results == []


@patch("blob.services.get_elasticsearch_connection")
@patch("blob.services.encode_text_query")
def test_threshold_filters_below_floor(mock_encode, mock_get_es):
    """Hits whose cosine similarity falls below the threshold are excluded from results."""
    from blob.services import find_similar_images

    mock_encode.return_value = [0.5] * 512
    mock_get_es.return_value.search.return_value = {
        "hits": {"hits": [
            {"_id": "high", "_score": 1.90},   # sim 0.95
            {"_id": "low",  "_score": 1.20},   # sim 0.60
        ]}
    }

    results = find_similar_images(user_id=42, text="x", threshold=0.7, limit=10)

    # Only the high-similarity hit should remain
    assert results == [("high", 0.95)]


def test_requires_exactly_one_input():
    """find_similar_images raises ValueError when zero or more than one input is provided."""
    from blob.services import find_similar_images

    with pytest.raises(ValueError):
        find_similar_images(user_id=42, threshold=0.5, limit=10)
    with pytest.raises(ValueError):
        find_similar_images(user_id=42, text="x", blob_uuid="y", threshold=0.5, limit=10)
