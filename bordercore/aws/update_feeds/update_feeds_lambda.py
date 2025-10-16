import logging
import os

import requests

logging.getLogger().setLevel(logging.INFO)
log = logging.getLogger(__name__)

DRF_TOKEN = os.environ.get("DRF_TOKEN")
TIMEOUT = (10.0, 10.0)


def handler(event, context):

    feed_uuid = None

    try:
        feed_uuid = event["feed_uuid"]
        headers = {"Authorization": f"Token {DRF_TOKEN}"}
        r = requests.post(f"https://www.bordercore.com/api/feeds/update_feed_list/{feed_uuid}/", headers=headers, timeout=TIMEOUT)

        if r.status_code != 200:
            raise Exception(f"Error: status code: {r.status_code}")

        log.info(f"Updated feed_uuid={feed_uuid}, {r.json()}")
    except Exception as e:
        log.error(f"Exception when updating feed_uuid={feed_uuid if feed_uuid is not None else '<unknown>'}: {e}")

    log.info("Lambda finished")
