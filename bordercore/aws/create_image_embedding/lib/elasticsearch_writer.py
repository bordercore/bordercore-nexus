"""Write image embeddings to the bordercore Elasticsearch index."""
from typing import Sequence

import numpy as np
import requests


def store_image_embedding(
    uuid: str,
    embedding: np.ndarray | Sequence[float],
    host: str,
    index: str,
    timeout: int = 10,
) -> None:
    """Write a CLIP image embedding to the Elasticsearch document for a blob.

    Uses a Painless script update to set the ``image_embedding`` field on the
    existing document identified by ``uuid``.

    Args:
        uuid: The blob's UUID string, used as the Elasticsearch document ID.
        embedding: The 512-dim embedding vector as a numpy array or sequence
            of floats.
        host: Elasticsearch hostname (without scheme or port).
        index: Elasticsearch index name.
        timeout: HTTP request timeout in seconds.

    Raises:
        requests.HTTPError: If Elasticsearch returns a non-2xx response.
    """
    if isinstance(embedding, np.ndarray):
        value = embedding.tolist()
    else:
        value = list(embedding)

    url = f"http://{host}:9200/{index}/_update/{uuid}"
    body = {
        "script": {
            "source": "ctx._source.image_embedding = params.value",
            "lang": "painless",
            "params": {"value": value},
        }
    }
    response = requests.post(url, json=body, timeout=timeout)
    if not response.ok:
        raise requests.HTTPError(
            f"ES update failed for {uuid}: {response.status_code} {response.text}",
            response=response,
        )
