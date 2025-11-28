import json
import logging
import os

import requests

from lib.embeddings import len_safe_get_embedding

logging.getLogger().setLevel(logging.INFO)
log = logging.getLogger(__name__)

DRF_TOKEN = os.environ.get("DRF_TOKEN")
ELASTICSEARCH_ENDPOINT = os.environ.get("ELASTICSEARCH_ENDPOINT", "localhost")
ELASTICSEARCH_INDEX = os.environ.get("ELASTICSEARCH_INDEX", "bordercore")


def store_in_elasticsearch(uuid, embeddings):

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
        print(f"Failed to store data. Response from Elasticsearch: {response.content}")
    else:
        print(f"{uuid} Data stored successfully.")


def get_blob_text(uuid):

    headers = {"Authorization": f"Token {DRF_TOKEN}"}
    session = requests.Session()
    session.trust_env = False

    r = session.get(f"https://www.bordercore.com/api/blobs/{uuid}/", headers=headers)

    if r.status_code != 200:
        raise Exception(f"Error when accessing Bordercore REST API: status code={r.status_code}")

    return r.json()["content"]


def handler(event, context):

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

    except Exception as e:
        log.error(f"{type(e)} exception: {e}")
        import traceback
        print(traceback.format_exc())
