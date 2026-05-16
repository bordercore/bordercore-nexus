"""Tests for the CreateImageEmbedding query-mode invoker."""
import base64
import json
from unittest.mock import MagicMock, patch


@patch("lib.image_search.boto3")
def test_encode_image_invokes_lambda_with_base64(mock_boto3):
    from lib.image_search import encode_image_query

    client = MagicMock()
    payload = MagicMock()
    payload.read.return_value = json.dumps({"vector": [0.1] * 512}).encode()
    client.invoke.return_value = {"Payload": payload}
    mock_boto3.client.return_value = client

    result = encode_image_query(b"PNGDATA")

    assert len(result) == 512
    kwargs = client.invoke.call_args.kwargs
    assert kwargs["FunctionName"] == "CreateImageEmbedding"
    assert kwargs["InvocationType"] == "RequestResponse"
    body = json.loads(kwargs["Payload"])
    assert body["mode"] == "query_image"
    assert base64.b64decode(body["image_b64"]) == b"PNGDATA"


@patch("lib.image_search.boto3")
def test_encode_text_invokes_lambda_with_text(mock_boto3):
    from lib.image_search import encode_text_query

    client = MagicMock()
    payload = MagicMock()
    payload.read.return_value = json.dumps({"vector": [0.2] * 512}).encode()
    client.invoke.return_value = {"Payload": payload}
    mock_boto3.client.return_value = client

    result = encode_text_query("sunset over water")

    assert len(result) == 512
    body = json.loads(client.invoke.call_args.kwargs["Payload"])
    assert body == {"mode": "query_text", "text": "sunset over water"}


@patch("lib.image_search.boto3")
def test_lambda_error_response_raises(mock_boto3):
    """If the Lambda returns an error JSON, the invoker should raise."""
    from lib.image_search import encode_text_query

    client = MagicMock()
    payload = MagicMock()
    payload.read.return_value = json.dumps({"error": "oh no"}).encode()
    client.invoke.return_value = {"Payload": payload}
    mock_boto3.client.return_value = client

    try:
        encode_text_query("anything")
    except RuntimeError as e:
        assert "oh no" in str(e)
    else:
        raise AssertionError("expected RuntimeError")


@patch("lib.image_search.boto3")
def test_lambda_function_error_raises(mock_boto3):
    """A Lambda runtime crash (FunctionError header) raises RuntimeError with the body."""
    from lib.image_search import encode_text_query

    client = MagicMock()
    payload = MagicMock()
    crash_body = {
        "errorMessage": "2024-01-01T00:00:00.000Z d9f3... Task timed out after 30.00 seconds",
        "errorType": "Runtime.ExitError",
        "stackTrace": [],
    }
    payload.read.return_value = json.dumps(crash_body).encode()
    client.invoke.return_value = {"Payload": payload, "FunctionError": "Unhandled"}
    mock_boto3.client.return_value = client

    try:
        encode_text_query("anything")
    except RuntimeError as e:
        assert "Runtime.ExitError" in str(e)
    else:
        raise AssertionError("expected RuntimeError")
