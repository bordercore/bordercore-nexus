import datetime
import logging
import time
from datetime import timedelta

import requests

import django

django.setup()

from bookmark.models import Bookmark  # isort:skip


# Remove existing handlers added by Django
for handler in logging.root.handlers[:]:
    logging.root.removeHandler(handler)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(name)-12s %(levelname)-8s %(message)s",
                    filename="/var/log/django/url-archiver.log",
                    datefmt="%m-%d %H:%M:%S",
                    filemode="a")

logger = logging.getLogger("bordercore.urlarchiver")

# Only let requests log at level WARNING or higher
requests_log = logging.getLogger("requests")
requests_log.setLevel(logging.WARNING)

import sentry_sdk

# Get all urls saved within the last day
with sentry_sdk.monitor(monitor_slug="archive-urls", monitor_config={
    "schedule": {"type": "crontab", "value": "30 2 * * *"},
    "checkin_margin": 5,
    "max_runtime": 60,
    "timezone": "America/New_York",
}):
    new_urls = Bookmark.objects.filter(
        created__gte=datetime.datetime.now(datetime.timezone.utc) - timedelta(seconds=86400))

    for url in new_urls:

        logger.info("Archiving {}".format(url.url))
        wayback_url = "https://web.archive.org/save/{}".format(url.url)

        try:
            r = requests.get(wayback_url)
            if r.status_code != 200:
                logger.warning(" Error, status code={}".format(r.status_code))
        except requests.TooManyRedirects as e:
            logger.error(f" Error when archiving {wayback_url}: {e}")
        time.sleep(10)
