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
