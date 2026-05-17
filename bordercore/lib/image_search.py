"""Synchronous invokers for the CreateImageEmbedding query modes.

For an uploaded query image or a free-text query, ship the input to the
CreateImageEmbedding Lambda in query_image or query_text mode and return
the resulting 512-dim CLIP vector. Bordercore's k-NN search uses these
vectors to find similar image blobs in Elasticsearch.
"""
import base64
import json
from typing import List

import boto3

_FUNCTION_NAME = "CreateImageEmbedding"


def _invoke(payload: dict) -> List[float]:
    """Invoke the CreateImageEmbedding Lambda synchronously and return the vector.

    Args:
        payload: Dict to send as the Lambda event payload.  Must produce a
            response with a ``"vector"`` key.

    Returns:
        The 512-dim CLIP embedding as a list of floats.

    Raises:
        RuntimeError: If the Lambda reports a function error or returns an
            ``"error"`` key in the response body.
    """
    client = boto3.client("lambda")
    response = client.invoke(
        FunctionName=_FUNCTION_NAME,
        InvocationType="RequestResponse",
        Payload=json.dumps(payload),
    )
    body = json.loads(response["Payload"].read())
    if response.get("FunctionError"):
        raise RuntimeError(f"CreateImageEmbedding Lambda crashed: {body}")
    if "error" in body:
        raise RuntimeError(f"CreateImageEmbedding returned error: {body['error']}")
    return body["vector"]


def encode_image_query(image_bytes: bytes) -> List[float]:
    """Encode raw image bytes to a CLIP embedding via the Lambda query_image mode.

    Args:
        image_bytes: Raw image data (JPEG, PNG, etc.).

    Returns:
        The 512-dim CLIP embedding as a list of floats.

    Raises:
        RuntimeError: If the Lambda invocation fails or returns an error.
    """
    return _invoke({
        "mode": "query_image",
        "image_b64": base64.b64encode(image_bytes).decode("ascii"),
    })


def encode_text_query(text: str) -> List[float]:
    """Encode a text description to a CLIP embedding via the Lambda query_text mode.

    Args:
        text: Free-text description of the image to search for.

    Returns:
        The 512-dim CLIP embedding as a list of floats.

    Raises:
        RuntimeError: If the Lambda invocation fails or returns an error.
    """
    return _invoke({"mode": "query_text", "text": text})
