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

from lib.embeddings import len_safe_get_embedding

logging.getLogger().setLevel(logging.INFO)
log = logging.getLogger(__name__)

DRF_TOKEN = os.environ.get("DRF_TOKEN")
ELASTICSEARCH_ENDPOINT = os.environ.get("ELASTICSEARCH_ENDPOINT", "localhost")
ELASTICSEARCH_INDEX = os.environ.get("ELASTICSEARCH_INDEX", "bordercore")


def store_in_elasticsearch(uuid: str | UUID, embeddings: list[float]) -> None:
    """Store embeddings vector in Elasticsearch for a blob.

    Updates the Elasticsearch document for the given UUID with the embeddings
    vector using a Painless script update operation.

    Args:
        uuid: UUID string or UUID object identifying the blob.
        embeddings: List of float values representing the embedding vector.
    """

    url = f"http://{ELASTICSEARCH_ENDPOINT}:9200/{ELASTICSEARCH_INDEX}/_update/{uuid}"
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
        print(f"Failed to store data. Response from Elasticsearch: {response.text}")
    else:
        print(f"{uuid} Data stored successfully.")


def get_blob_text(uuid: str | UUID) -> str:
    """Retrieve blob text content from the Bordercore REST API.

    Fetches the blob content using the Django REST Framework API endpoint
    with authentication token.

    Args:
        uuid: UUID string or UUID object identifying the blob.

    Returns:
        Text content of the blob.

    Raises:
        Exception: If the API request fails or returns a non-200 status code.
    """

    headers = {"Authorization": f"Token {DRF_TOKEN}"}
    session = requests.Session()
    session.trust_env = False

    r = session.get(f"https://www.bordercore.com/api/blobs/{uuid}/", headers=headers)

    if r.status_code != 200:
        raise Exception(f"Error when accessing Bordercore REST API: status code={r.status_code}")

    return r.json()["content"]


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
            blob_text = get_blob_text(uuid=uuid)
            embeddings = len_safe_get_embedding(blob_text)

            if embeddings is not None:
                store_in_elasticsearch(uuid, embeddings)
        elif "text" in event:
            return json.dumps(len_safe_get_embedding(event["text"]))

        log.info("Lambda finished")
        return None

    except Exception as e:
        log.error(f"{type(e)} exception: {e}")
        import traceback
        print(traceback.format_exc())
        return None
