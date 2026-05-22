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

from lib.embeddings import build_blob_embedding_text, len_safe_get_embedding

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


def store_in_elasticsearch(uuid: str | UUID, embeddings: list[float]) -> None:
    """Store embeddings vector in Elasticsearch for a blob.

    Updates the Elasticsearch document for the given UUID with the embeddings
    vector using a Painless script update operation.

    Args:
        uuid: UUID string or UUID object identifying the blob.
        embeddings: List of float values representing the embedding vector.
    """

    url = _elasticsearch_update_url(uuid)
    headers = {"Content-Type": "application/json"}

    data = {
        "script": {
            "source": "ctx._source.embeddings_vector = params.value",
            "lang": "painless",
            "params": {
                "value": embeddings
            }
        }
    }

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


def get_blob_embedding_text(uuid: str | UUID) -> str:
    """Build the text payload embedded for a blob.

    Args:
        uuid: UUID string or UUID object identifying the blob.

    Returns:
        Title, tags, and content formatted for embedding.
    """
    payload = get_blob_payload(uuid=uuid)
    return build_blob_embedding_text(
        payload.get("content") or "",
        name=payload.get("name") or "",
        tags=payload.get("tags") or [],
    )


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
            blob_text = get_blob_embedding_text(uuid=uuid)
            embeddings = len_safe_get_embedding(blob_text)

            if embeddings is not None:
                store_in_elasticsearch(uuid, embeddings)
        elif "text" in event:
            return json.dumps(len_safe_get_embedding(event["text"]))

        log.info("Lambda finished")
        return None

    except Exception as e:
        log.error("%s exception: %s", type(e).__name__, e, exc_info=True)
        raise
