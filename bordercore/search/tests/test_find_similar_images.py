"""Tests for find_similar_images service."""
from unittest.mock import patch

import pytest


@patch("search.services.get_elasticsearch_connection")
@patch("search.services.encode_text_query")
def test_find_by_text_calls_lambda_then_knn(mock_encode, mock_get_es):
    """Text mode encodes via Lambda, runs a native kNN query, and returns similarities."""
    from search.services import find_similar_images

    mock_encode.return_value = [0.1] * 512
    es = mock_get_es.return_value
    es.search.return_value = {
        "hits": {"hits": [
            {"_id": "uuid-1", "_score": 0.975},
            {"_id": "uuid-2", "_score": 0.915},
        ]}
    }

    results = find_similar_images(user_id=42, text="sunset", threshold=0.5, limit=10)

    mock_encode.assert_called_once_with("sunset")
    knn = es.search.call_args.kwargs["knn"]
    assert knn["field"] == "image_embedding"
    assert knn["query_vector"] == [0.1] * 512
    assert es.search.call_args.kwargs["size"] == 10
    # Native cosine kNN scores are already in [0, 1]; passed through unchanged.
    assert results == [("uuid-1", 0.975), ("uuid-2", 0.915)]


@patch("search.services.get_elasticsearch_connection")
def test_find_by_blob_uuid_pulls_stored_vector(mock_get_es):
    """blob_uuid mode fetches the stored embedding from ES instead of calling the Lambda."""
    from search.services import find_similar_images

    es = mock_get_es.return_value
    es.get.return_value = {"_source": {"image_embedding": [0.3] * 512}}
    es.search.return_value = {
        "hits": {"hits": [{"_id": "uuid-x", "_score": 1.0}]}
    }

    results = find_similar_images(user_id=42, blob_uuid="abc", threshold=0, limit=5)

    es.get.assert_called_once()
    knn = es.search.call_args.kwargs["knn"]
    assert knn["query_vector"] == [0.3] * 512
    # blob_uuid mode excludes the source blob from results
    assert any("must_not" in str(clause) for clause in knn["filter"])
    # Native kNN cosine score 1.0 -> similarity 1.0
    assert results == [("uuid-x", 1.0)]


@patch("search.services.get_elasticsearch_connection")
@patch("search.services.encode_image_query")
def test_find_by_image_bytes(mock_encode, mock_get_es):
    """image_bytes mode encodes the uploaded bytes via the Lambda and queries ES."""
    from search.services import find_similar_images

    mock_encode.return_value = [0.2] * 512
    mock_get_es.return_value.search.return_value = {"hits": {"hits": []}}

    results = find_similar_images(user_id=42, image_bytes=b"PNG", threshold=0.9, limit=10)

    mock_encode.assert_called_once_with(b"PNG")
    assert results == []


@patch("search.services.get_elasticsearch_connection")
@patch("search.services.encode_text_query")
def test_threshold_filters_below_floor(mock_encode, mock_get_es):
    """Hits whose cosine similarity falls below the threshold are excluded from results."""
    from search.services import find_similar_images

    mock_encode.return_value = [0.5] * 512
    mock_get_es.return_value.search.return_value = {
        "hits": {"hits": [
            {"_id": "high", "_score": 0.95},   # native kNN cosine similarity
            {"_id": "low",  "_score": 0.60},
        ]}
    }

    results = find_similar_images(user_id=42, text="x", threshold=0.7, limit=10)

    # Only the high-similarity hit should remain
    assert results == [("high", 0.95)]


def test_requires_exactly_one_input():
    """find_similar_images raises ValueError when zero or more than one input is provided."""
    from search.services import find_similar_images

    with pytest.raises(ValueError):
        find_similar_images(user_id=42, threshold=0.5, limit=10)
    with pytest.raises(ValueError):
        find_similar_images(user_id=42, text="x", blob_uuid="y", threshold=0.5, limit=10)


@pytest.mark.data_quality
def test_find_similar_images_knn_unit_range():
    """Real-cluster: find_similar_images uses native kNN, similarities in [0, 1],
    and the source blob is excluded from its own results."""
    from django.conf import settings

    from lib.util import get_elasticsearch_connection
    from search.services import find_similar_images

    es = get_elasticsearch_connection()
    resp = es.search(
        index=settings.ELASTICSEARCH_INDEX, size=1, source=["uuid"],
        query={"bool": {"must": [
            {"term": {"user_id": 1}},
            {"exists": {"field": "image_embedding"}},
        ]}},
    )
    src_uuid = resp["hits"]["hits"][0]["_id"]

    results = find_similar_images(user_id=1, blob_uuid=src_uuid, threshold=0.0, limit=5)
    assert results, "expected similar-image hits"
    for uuid_, sim in results:
        assert 0.0 <= sim <= 1.0, sim
        assert uuid_ != src_uuid
