"""AWS Lambda function for updating RSS/Atom feeds.

This module provides an AWS Lambda handler that triggers feed updates by
calling the Bordercore REST API endpoint. It processes feed UUIDs and
fetches new entries from RSS/Atom feeds.
"""

import logging
import os
from typing import Any

import requests

logging.getLogger().setLevel(logging.INFO)
log = logging.getLogger(__name__)

DRF_TOKEN = os.environ.get("DRF_TOKEN")
TIMEOUT = (10.0, 10.0)


def handler(event: dict[str, Any], context: Any) -> None:
    """AWS Lambda handler for updating feeds.

    Processes events containing feed UUIDs and triggers feed updates via
    the REST API. Handles errors gracefully and logs completion status.

    Args:
        event: Lambda event dictionary containing "feed_uuid" key.
        context: Lambda context object (unused but required by Lambda interface).
    """

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
