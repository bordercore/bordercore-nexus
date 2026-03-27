#!/usr/bin/env python
# encoding: utf-8

import django

django.setup()

import sentry_sdk
from bookmark.models import Bookmark

with sentry_sdk.monitor(monitor_slug="reset-daily-links", monitor_config={
    "schedule": {"type": "crontab", "value": "30 3 * * *"},
    "checkin_margin": 5,
    "max_runtime": 10,
    "timezone": "America/New_York",
}):
    daily_bookmarks = Bookmark.objects.filter(daily__isnull=False)
    for bookmark in daily_bookmarks:
        bookmark.daily['viewed'] = 'false'
        bookmark.save()
