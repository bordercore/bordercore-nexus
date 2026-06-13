#!/usr/bin/env python
# encoding: utf-8

import logging
import sys

import django

django.setup()

import sentry_sdk  # noqa: E402

from feed.services import refresh_feeds  # noqa: E402  isort:skip

LOG_FILE = "/var/log/django/get_feed.log"

# Mirror feed-app warnings (failed fetches) into the cron log file when it is
# writable; on machines without /var/log/django this is simply skipped.
try:
    _handler = logging.FileHandler(LOG_FILE)
    _handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    _feed_log = logging.getLogger("bordercore.feed")
    _feed_log.addHandler(_handler)
    _feed_log.setLevel(logging.INFO)
except OSError as e:
    sys.stderr.write(f"Warning: could not open {LOG_FILE}: {e}\n")


if __name__ == "__main__":
    with sentry_sdk.monitor(monitor_slug="get-feed", monitor_config={
        "schedule": {"type": "crontab", "value": "5 */4 * * *"},
        "checkin_margin": 5,
        "max_runtime": 30,
        "timezone": "America/New_York",
    }):
        feed_uuid = sys.argv[1] if len(sys.argv) == 2 else None
        refresh_feeds(feed_uuid)
