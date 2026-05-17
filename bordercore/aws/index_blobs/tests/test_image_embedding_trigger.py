"""Tests that IndexBlobs invokes CreateImageEmbedding for image blobs."""
from unittest.mock import patch


@patch("lib.elasticsearch_indexer.boto3")
def test_invoke_create_image_embedding(mock_boto3):
    """create_image_embedding invokes CreateImageEmbedding Lambda in Event mode."""
    from lib.elasticsearch_indexer import create_image_embedding

    create_image_embedding("abc-uuid")

    mock_boto3.client.assert_called_with("lambda")
    call = mock_boto3.client.return_value.invoke.call_args
    kwargs = call.kwargs if call.kwargs else call[1]
    assert kwargs["FunctionName"] == "CreateImageEmbedding"
    assert kwargs["InvocationType"] == "Event"
    import json
    payload = json.loads(kwargs["Payload"])
    assert payload == {"mode": "index", "uuid": "abc-uuid"}


def test_is_image_blob_detects_image_content_types():
    """is_image_blob returns True for image/* MIME types and False otherwise."""
    from lib.elasticsearch_indexer import is_image_blob

    assert is_image_blob("image/jpeg") is True
    assert is_image_blob("image/png") is True
    assert is_image_blob("image/webp") is True
    assert is_image_blob("image/gif") is True
    assert is_image_blob("application/pdf") is False
    assert is_image_blob(None) is False
    assert is_image_blob("") is False
