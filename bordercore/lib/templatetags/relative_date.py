"""Template filter for formatting dates as relative time strings.

This module provides a Django template filter that converts datetime objects
to human-readable relative time strings (e.g., "2 hours ago", "yesterday").
"""

import datetime

from django import template

from lib.time_utils import get_relative_date_from_date

register = template.Library()


@register.filter
def relative_date(date: datetime.datetime) -> str:
    """Convert a datetime to a human-readable relative time string.

    Args:
        date: Datetime object to format as a relative time string.

    Returns:
        Human-readable relative time string (e.g., "2 hours ago",
        "yesterday", "3 days ago").
    """
    return get_relative_date_from_date(date)
