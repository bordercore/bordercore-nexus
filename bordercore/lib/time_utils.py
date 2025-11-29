"""Time and date utility functions.

This module provides utilities for formatting dates and times in human-readable
formats, parsing various date formats, and converting between different date
representations. Functions include relative time formatting (e.g., "2 hours ago"),
date pattern extraction from Elasticsearch queries, and date parsing for various
input formats.

Adapted from:
http://stackoverflow.com/questions/1551382/user-friendly-time-format-in-python
"""

import datetime
import re
import time
from re import Match
from typing import Callable, cast

import pytz

# Time constants for relative date calculations
SECONDS_PER_MINUTE = 60
SECONDS_PER_HOUR = 3600
SECONDS_PER_DAY = 86400
DAYS_PER_WEEK = 7
DAYS_PER_MONTH_APPROX = 30
DAYS_PER_MONTH_THRESHOLD = 31
DAYS_PER_YEAR = 365

# Thresholds for relative time formatting
JUST_NOW_THRESHOLD_SECONDS = 10
TWO_MINUTES_SECONDS = 120
TWO_HOURS_SECONDS = 7200


def cleanup(interval: float | int, time_unit: str) -> str:
    """Format a time interval as a human-readable string.

    Args:
        interval: The numeric interval value.
        time_unit: The unit name (e.g., "second", "minute", "hour").

    Returns:
        A formatted string like "1 second ago" or "5 minutes ago".
    """
    interval = int(interval)

    if interval == 1:
        return f"1 {time_unit} ago"
    return f"{interval} {time_unit}s ago"


def _get_relative_date_from_datetime(time_dt: datetime.datetime) -> str:
    """Calculate relative date string from a datetime object.

    Internal helper function that performs the actual relative date calculation.
    Works directly with datetime objects to avoid unnecessary string conversions.

    Args:
        time_dt: The datetime object to format.

    Returns:
        A human-readable relative time string, or empty string if time is in the future.
    """
    now = datetime.datetime.now(pytz.timezone("US/Eastern"))

    # Ensure time_dt is timezone-aware for comparison
    if time_dt.tzinfo is None:
        # If naive, assume it's in the same timezone as 'now'
        time_dt = pytz.timezone("US/Eastern").localize(time_dt)

    diff = now - time_dt
    second_diff = diff.seconds
    day_diff = diff.days

    if day_diff < 0:
        return ""

    if day_diff == 0:
        if second_diff < JUST_NOW_THRESHOLD_SECONDS:
            return "just now"
        if second_diff < SECONDS_PER_MINUTE:
            return cleanup(second_diff, "second")
        if second_diff < TWO_MINUTES_SECONDS:
            return "a minute ago"
        if second_diff < SECONDS_PER_HOUR:
            return cleanup(second_diff / SECONDS_PER_MINUTE, "minute")
        if second_diff < TWO_HOURS_SECONDS:
            return "an hour ago"
        if second_diff < SECONDS_PER_DAY:
            return cleanup(second_diff / SECONDS_PER_HOUR, "hour")
    if day_diff == 1:
        return "Yesterday"
    if day_diff < DAYS_PER_WEEK:
        return cleanup(day_diff, "day")
    if day_diff < DAYS_PER_MONTH_THRESHOLD:
        return cleanup(day_diff / DAYS_PER_WEEK, "week")
    if day_diff < DAYS_PER_YEAR:
        return cleanup(day_diff / DAYS_PER_MONTH_APPROX, "month")
    return cleanup(day_diff / DAYS_PER_YEAR, "year")


def get_relative_date_from_date(time: datetime.datetime) -> str:
    """Get a relative date string from a datetime object.

    Converts a datetime object to a human-readable relative time string like
    "an hour ago", "Yesterday", "3 months ago", or "just now".

    Args:
        time: The datetime object to format.

    Returns:
        A human-readable relative time string.
    """
    return _get_relative_date_from_datetime(time)


def get_relative_date(time: str | None = None) -> str:
    """Get a relative date string from a datetime string.

    Converts a datetime string to a human-readable relative time string like
    "an hour ago", "Yesterday", "3 months ago", or "just now". The input string
    should be in ISO format with timezone information.

    Args:
        time: The datetime string in ISO format (e.g., "2023-01-01T12:00:00.000000+0000").
            If None or empty string, returns empty string.

    Returns:
        A human-readable relative time string, or empty string if time is None,
        empty string, or in the future.
    """
    if not time:
        return ""

    # Type narrowing: after the checks above, time must be a non-empty string
    time_str = cast(str, time)

    # Parse the string to datetime object, then use the internal helper
    try:
        time_dt = datetime.datetime.strptime(time_str, "%Y-%m-%dT%H:%M:%S.%f%z")
    except ValueError:
        time_dt = datetime.datetime.strptime(time_str, "%Y-%m-%dT%H:%M:%S%z")

    return _get_relative_date_from_datetime(time_dt)


def get_date_from_pattern(pattern: dict[str, str | None] | None) -> str | None:
    """Extract and format a date from an Elasticsearch date range pattern.

    Extracts the "gte" (greater than or equal) value from an Elasticsearch date
    range dictionary and formats it as a human-readable date string. Supports
    various date formats including full dates, year-month, year-only, and range
    formats.

    Args:
        pattern: An Elasticsearch date range dictionary with "gte" and optionally
            "lte" keys (values may be None), or None.

    Returns:
        A formatted date string (e.g., "January 15, 2023", "January 2023", "2023",
        or "2023-01 to 2023-02"), or None if pattern is None or has no "gte" value.
    """
    if pattern is None:
        return None

    date = pattern.get("gte", None)

    if date is None:
        return None

    if re.compile(r'^\d{4}-\d{2}-\d{2}$').match(date):
        return datetime.datetime.strptime(date, '%Y-%m-%d').strftime('%B %d, %Y')
    if re.compile(r'^\d{4}-\d{2}$').match(date):
        return datetime.datetime.strptime(date, '%Y-%m').strftime('%B %Y')
    if re.compile(r'^\d{4}$').match(date):
        return date
    if re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}').match(date):
        return datetime.datetime.strptime(date, '%Y-%m-%dT%H:%M:%S').strftime('%B %d, %Y')
    if re.compile(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}').match(date):
        return datetime.datetime.strptime(date, '%Y-%m-%d %H:%M:%S').strftime('%B %d, %Y')
    matches = re.compile(r'^\[([-\d]*) TO ([-\d]*)\]$').match(date)
    if matches:
        return f"{matches.group(1)} to {matches.group(2)}"

    return date


def convert_seconds(seconds: int | float | None) -> str:
    """Convert seconds to a human-readable time interval string.

    Converts a number of seconds into a formatted time string like "05:39" (for
    339 seconds, representing 5 minutes and 39 seconds). Strips leading zeros
    from hours and minutes when appropriate.

    Args:
        seconds: The number of seconds to convert, or None.

    Returns:
        A formatted time string (e.g., "05:39", "1:23:45"), or "N/A" if seconds
        is None or falsy.
    """
    if not seconds:
        return "N/A"

    time_string = time.strftime("%H:%M:%S", time.gmtime(seconds))

    # Ignore any leading '0's
    pattern = re.compile(r"00:0?(\d{1,2}:\d{2})")
    matches = pattern.match(time_string)

    if matches:
        return matches.group(1)
    return time_string


def parse_date_format_1(input_date: str) -> datetime.datetime:
    """Parse a date string in format '01/01/18'.

    Args:
        input_date: The date string to parse.

    Returns:
        A datetime object representing the parsed date.
    """
    return datetime.datetime.strptime(input_date, '%m/%d/%y')


def parse_date_format_2(input_date: str) -> datetime.datetime:
    """Parse a date string in format '01/01/2018'.

    Args:
        input_date: The date string to parse.

    Returns:
        A datetime object representing the parsed date.
    """
    return datetime.datetime.strptime(input_date, '%m/%d/%Y')


def parse_date_format_3(input_date: str, matcher: Match[str]) -> datetime.datetime:
    """Parse a date string in format 'Jan 01, 2018'.

    Args:
        input_date: The date string to parse.
        matcher: A regex match object containing groups for month, day, and year.

    Returns:
        A datetime object representing the parsed date.
    """
    return datetime.datetime.strptime(f"{matcher.group(1)}/{matcher.group(2)}/{matcher.group(3)}", "%b/%d/%Y")


def parse_date_format_4(input_date: str, matcher: Match[str]) -> datetime.datetime:
    """Parse a date string in format 'January 01, 2018'.

    Args:
        input_date: The date string to parse.
        matcher: A regex match object containing groups for month, day, and year.

    Returns:
        A datetime object representing the parsed date.
    """
    return datetime.datetime.strptime(f"{matcher.group(1)}/{matcher.group(2)}/{matcher.group(3)}", "%B/%d/%Y")


def parse_date_format_5(input_date: str, matcher: Match[str]) -> datetime.datetime:
    """Parse a date string in format '2020-01-12'.

    Args:
        input_date: The date string to parse.
        matcher: A regex match object containing groups for year, month, and day.

    Returns:
        A datetime object representing the parsed date.
    """
    return datetime.datetime.strptime(f"{matcher.group(2)}/{matcher.group(3)}/{matcher.group(1)}", "%m/%d/%Y")


def parse_date_from_string(input_date: str) -> str:
    """Parse a date string from various formats and return ISO format string.

    Attempts to parse a date string from multiple common formats including:
    - "01/01/99" or "01/01/1999"
    - "Jan 1, 1999" or "January 1, 1999"
    - "1999-01-01"

    The order of regex patterns is important - shorter patterns (like "Feb") must
    match before longer patterns (like "February") to ensure the correct parser
    is called.

    Args:
        input_date: The date string to parse. May include ordinal suffixes like
            "12th" which will be stripped.

    Returns:
        An ISO format date string with "T00:00" appended (e.g., "2023-01-15T00:00")
        to force JavaScript to use localtime rather than UTC.

    Raises:
        ValueError: If the input date format is not recognized.
    """
    # The order of these regexes is important!
    # We need 'Feb' to match before 'February', for example, so that the
    #  right 'parse_date_' function is called

    pdict: dict[str, Callable[..., datetime.datetime]] = {
        # 01/01/99
        r"(\d+)/(\d+)/(\d{2})$": parse_date_format_1,
        # 01/01/1999
        r"(\d+)/(\d+)/(\d{4})$": parse_date_format_2,
        # Jan 1, 1999
        r"(\w\w\w)\.?\s+(\d+),?\s+(\d+)$": parse_date_format_3,
        # January 1, 1999
        r"(\w+)\.?\s+(\d+),?\s+(\d+)$": parse_date_format_4,
        # 1999-01-01
        r"(\d{4})-(\d+)-(\d+)$": parse_date_format_5,
    }

    # Remove extraneous characters
    # eg "August 12th, 2001" becomes "August 12, 2001"
    input_date = re.sub(r"(\d+)(?:nd|rd|st|th)", r"\1", input_date)
    for key, value in pdict.items():
        m = re.compile(key).match(input_date)
        if m:
            # Add hour and minute to force JavaScript to use localtime rather than UTC
            # parse_date_format_1 and parse_date_format_2 don't need the matcher
            if value in (parse_date_format_1, parse_date_format_2):
                return value(input_date).strftime("%Y-%m-%dT00:00")
            return value(input_date, m).strftime("%Y-%m-%dT00:00")

    raise ValueError(f"Unknown date format: {input_date}")


def get_javascript_date(date: str) -> str:
    """Return a sanitized date string for JavaScript datepicker widgets.

    Formats a date string for use with the vuejs-datepicker widget. Adds "T00:00"
    suffix to ensure JavaScript uses localtime rather than UTC. Removes time
    components if present, as the datepicker widget will reject dates with times.

    Args:
        date: The date string to sanitize. May be in formats like "2023-01-15",
            "2023-01-15 12:00:00", or "2023".

    Returns:
        A sanitized date string with "T00:00" appended (e.g., "2023-01-15T00:00"),
        or the original string if it's a year-only format (e.g., "2023").
    """
    if re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}").match(date):
        # If the date has a time, remove it. The vuejs-datepicker widget will reject it.
        return datetime.datetime.strptime(date, "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%dT00:00")
    if re.compile(r"^\d{4}$").match(date):
        return date
    return date + "T00:00"
