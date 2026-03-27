#!/usr/bin/env python
# encoding: utf-8

import datetime
import json
import sys

import boto3

import django

django.setup()

from feed.models import Feed  # isort:skip


LOG_FILE = "/var/log/django/get_feed.log"
client = boto3.client("lambda")


def update_feeds(feed_uuid=None):

    # If an argument is supplied on the command line, interpret that as the
    #  feed uuid to update.  Otherwise update all feeds.
    info = None

    if feed_uuid:
        info = Feed.objects.filter(uuid=feed_uuid)
    else:
        info = Feed.objects.all()

    for feed in info:

        payload = {
            "feed_uuid": str(feed.uuid)
        }

        try:

            client.invoke(
                ClientContext="MyApp",
                FunctionName="UpdateFeeds",
                InvocationType="Event",
                LogType="Tail",
                Payload=json.dumps(payload)
            )

        except Exception as e:
            t = datetime.datetime.now(datetime.timezone.utc)
            log_file = open(LOG_FILE, "a")
            log_file.write(f"{t.strftime('%Y-%m-%d %H:%M:%S')} Exception for {feed.name} (feed_id {feed.id}): {e.args}\n")
            log_file.close()


if __name__ == "__main__":
    import sentry_sdk

    with sentry_sdk.monitor(monitor_slug="get-feed", monitor_config={
        "schedule": {"type": "crontab", "value": "5 */4 * * *"},
        "checkin_margin": 5,
        "max_runtime": 30,
        "timezone": "America/New_York",
    }):
        feed_uuid = sys.argv[1] if len(sys.argv) == 2 else None
        update_feeds(feed_uuid)
