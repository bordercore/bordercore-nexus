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
    return _invoke({
        "mode": "query_image",
        "image_b64": base64.b64encode(image_bytes).decode("ascii"),
    })


def encode_text_query(text: str) -> List[float]:
    return _invoke({"mode": "query_text", "text": text})
