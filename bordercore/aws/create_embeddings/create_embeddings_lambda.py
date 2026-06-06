"""AWS Lambda function for creating and storing embeddings.

This module provides an AWS Lambda handler that creates embeddings for blob
content or arbitrary text using the configured embedding model. Embeddings
are stored in Elasticsearch for use in semantic search and similarity matching.
"""

import json
import logging
import os
from typing import Any
from uuid import UUID

import requests

from lib.embeddings import build_blob_embedding_text, build_note_chunks, len_safe_get_embedding

logging.getLogger().setLevel(logging.INFO)
log = logging.getLogger(__name__)

DRF_TOKEN = os.environ.get("DRF_TOKEN")
ELASTICSEARCH_ENDPOINT = os.environ.get("ELASTICSEARCH_ENDPOINT", "localhost")
ELASTICSEARCH_INDEX = os.environ.get("ELASTICSEARCH_INDEX", "bordercore")


def _elasticsearch_update_url(uuid: str | UUID) -> str:
    """Build the Elasticsearch _update URL for a blob UUID.

    ``ELASTICSEARCH_ENDPOINT`` may be either a bare hostname or include a scheme
    (for example ``http://ec2-...amazonaws.com``). Avoid doubling the scheme.
    """
    endpoint = ELASTICSEARCH_ENDPOINT.strip().rstrip("/")
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        base = endpoint
    else:
        base = f"http://{endpoint}"
    return f"{base}:9200/{ELASTICSEARCH_INDEX}/_update/{uuid}"


def store_in_elasticsearch(
    uuid: str | UUID,
    embeddings: list[float],
    *,
    chunks: list[dict[str, Any]] | None = None,
) -> None:
    """Store the averaged embeddings vector (and, for notes, the chunk array).

    Args:
        uuid: UUID identifying the blob.
        embeddings: The note/blob's averaged embedding vector.
        chunks: Optional nested ``chunks`` array ([{text, vector}, ...]) for notes.
    """
    url = _elasticsearch_update_url(uuid)
    headers = {"Content-Type": "application/json"}

    source = "ctx._source.embeddings_vector = params.value"
    params: dict[str, Any] = {"value": embeddings}
    if chunks is not None:
        source += "; ctx._source.chunks = params.chunks"
        params["chunks"] = chunks

    data = {"script": {"source": source, "lang": "painless", "params": params}}

    response = requests.post(url, headers=headers, data=json.dumps(data), timeout=10)

    if response.status_code != 200:
        raise RuntimeError(
            f"Failed to store embeddings for {uuid}. "
            f"Elasticsearch responded {response.status_code}: {response.text}"
        )
    print(f"{uuid} Data stored successfully.")


def get_blob_payload(uuid: str | UUID) -> dict[str, Any]:
    """Retrieve blob fields needed for embedding from the Bordercore REST API.

    Args:
        uuid: UUID string or UUID object identifying the blob.

    Returns:
        Parsed JSON body from the blob detail endpoint.

    Raises:
        Exception: If the API request fails or returns a non-200 status code.
    """

    headers = {"Authorization": f"Token {DRF_TOKEN}"}
    session = requests.Session()
    session.trust_env = False

    r = session.get(f"https://www.bordercore.com/api/blobs/{uuid}/", headers=headers)

    if r.status_code != 200:
        raise Exception(f"Error when accessing Bordercore REST API: status code={r.status_code}")

    return r.json()


def handler(event: dict[str, Any], context: Any) -> str | None:
    """AWS Lambda handler for creating embeddings.

    Processes events containing either a blob UUID or text content. For UUIDs,
    retrieves blob content, creates embeddings, and stores them in Elasticsearch.
    For text, returns the embeddings as a JSON string.

    Args:
        event: Lambda event dictionary containing either "uuid" or "text" key.
        context: Lambda context object (unused but required by Lambda interface).

    Returns:
        JSON string of embeddings if processing text, None otherwise.
    """

    try:
        if "uuid" in event:
            uuid = event["uuid"]

            log.info(f"Creating embeddings for uuid={uuid}")
            payload = get_blob_payload(uuid=uuid)
            content = payload.get("content") or ""
            blob_text = build_blob_embedding_text(
                content,
                name=payload.get("name") or "",
                tags=payload.get("tags") or [],
            )
            embeddings = len_safe_get_embedding(blob_text)
            chunks = build_note_chunks(content) if (payload.get("is_note") and content) else None

            if embeddings:
                store_in_elasticsearch(uuid, embeddings, chunks=chunks)
        elif "text" in event:
            return json.dumps(len_safe_get_embedding(event["text"]))

        log.info("Lambda finished")
        return None

    except Exception as e:
        log.error("%s exception: %s", type(e).__name__, e, exc_info=True)
        raise
