"""AWS Lambda handler for image-blob embeddings.

Modes:

* index       — fetch thumbnail by uuid, encode, write to ES (async caller)
* query_image — accept a base64-encoded image, return the embedding (sync)
* query_text  — accept a text string, return the embedding (sync)
"""
import base64
import logging
import os
from typing import Any

from lib.clip_onnx import encode_image, encode_text
from lib.elasticsearch_writer import store_image_embedding
from lib.thumbnail_fetcher import fetch_thumbnail

logging.getLogger().setLevel(logging.INFO)
log = logging.getLogger(__name__)

ELASTICSEARCH_ENDPOINT = os.environ.get("ELASTICSEARCH_ENDPOINT", "localhost")
ELASTICSEARCH_INDEX = os.environ.get("ELASTICSEARCH_INDEX", "bordercore")
S3_BUCKET = os.environ.get("AWS_STORAGE_BUCKET_NAME", "")


# Return dicts (or None), not pre-serialised JSON strings — the Lambda
# runtime serialises the return value for us, and the synchronous invoker
# parses one layer of JSON. Pre-serialising would double-encode and the
# caller would receive a string instead of a dict.
def handler(event: dict[str, Any], context: Any) -> dict[str, Any] | None:
    mode = event.get("mode")
    try:
        if mode == "index":
            uuid = event["uuid"]
            log.info("Indexing image embedding for %s", uuid)
            data = fetch_thumbnail(uuid, bucket=S3_BUCKET)
            vec = encode_image(data)
            store_image_embedding(
                uuid, vec, host=ELASTICSEARCH_ENDPOINT, index=ELASTICSEARCH_INDEX
            )
            return None

        if mode == "query_image":
            data = base64.b64decode(event["image_b64"])
            vec = encode_image(data)
            return {"vector": vec.tolist()}

        if mode == "query_text":
            vec = encode_text(event["text"])
            return {"vector": vec.tolist()}

        return {"error": f"unknown mode: {mode!r}"}
    except Exception as e:
        log.exception("Handler failed")
        return {"error": str(e)}
