import datetime
from unittest.mock import Mock, patch

import pytest
import pytz

from lib.time_utils import (cleanup, convert_seconds, get_date_from_pattern,
                            get_javascript_date, get_relative_date,
                            parse_date_from_string)


def test_cleanup():
    """Test that cleanup formats a time value and unit into a relative time string."""

    assert cleanup(1, "second") == "1 second ago"
    assert cleanup(2, "hour") == "2 hours ago"


def test_get_relative_date():
    """Test that get_relative_date returns correct human-readable relative time strings."""

    timezone = pytz.timezone("US/Eastern")
    datetime_mock = Mock(wraps=datetime.datetime)
    datetime_mock.now.return_value = timezone.localize(datetime.datetime(2020, 4, 28, 8, 0, 0))

    # Patch what datetime.now() returns with a mock
    with patch("datetime.datetime", new=datetime_mock):
        assert get_relative_date("2020-04-28T09:00:00-0400") == ""
        assert get_relative_date("2020-04-28T07:59:55-0400") == "just now"
        assert get_relative_date("2020-04-28T07:59:30-0400") == "30 seconds ago"
        assert get_relative_date("2020-04-28T07:59:00-0400") == "a minute ago"
        assert get_relative_date("2020-04-28T07:30:00-0400") == "30 minutes ago"
        assert get_relative_date("2020-04-28T07:00:00-0400") == "an hour ago"
        assert get_relative_date("2020-04-28T02:00:00-0400") == "6 hours ago"
        assert get_relative_date("2020-04-27T08:00:00-0400") == "Yesterday"
        assert get_relative_date("2020-04-25T08:00:00-0400") == "3 days ago"
        assert get_relative_date("2020-04-13T08:00:00-0400") == "2 weeks ago"
        assert get_relative_date("2020-03-13T08:00:00-0400") == "1 month ago"
        assert get_relative_date("2017-03-13T08:00:00-0400") == "3 years ago"


def test_convert_seconds():
    """Test that convert_seconds formats seconds into mm:ss or hh:mm:ss strings."""

    assert convert_seconds(339) == "5:39"
    assert convert_seconds(7200) == "02:00:00"
    assert convert_seconds(None) == "N/A"


def test_get_date_from_pattern():
    """Test that get_date_from_pattern parses various date dict formats into display strings."""

    assert get_date_from_pattern(None) is None

    assert get_date_from_pattern({"gte": None}) is None

    date_string = {"gte": "1999-01-01"}
    assert get_date_from_pattern(date_string) == "January 01, 1999"

    date_string = {"gte": "1999-01"}
    assert get_date_from_pattern(date_string) == "January 1999"

    date_string = {"gte": "1999"}
    assert get_date_from_pattern(date_string) == "1999"

    date_string = {"gte": "1999-01-01T08:00:00"}
    assert get_date_from_pattern(date_string) == "January 01, 1999"

    date_string = {"gte": "1999-01-01 08:00:00"}
    assert get_date_from_pattern(date_string) == "January 01, 1999"

    date_string = {"gte": "[1999-01 TO 1999-02]"}
    assert get_date_from_pattern(date_string) == "1999-01 to 1999-02"

    assert get_date_from_pattern({"gte": "Not a date"}) == "Not a date"


def test_parse_date_from_string():
    """Test that parse_date_from_string converts various date string formats to ISO format."""

    date_string = "01/01/99"
    assert parse_date_from_string(date_string) == "1999-01-01T00:00"

    date_string = "01/01/1999"
    assert parse_date_from_string(date_string) == "1999-01-01T00:00"

    date_string = "Jan 01, 1999"
    assert parse_date_from_string(date_string) == "1999-01-01T00:00"

    date_string = "January 1, 1999"
    assert parse_date_from_string(date_string) == "1999-01-01T00:00"

    date_string = "1999-01-01"
    assert parse_date_from_string(date_string) == "1999-01-01T00:00"

    date_string = "August 12th, 2001"
    assert parse_date_from_string(date_string) == "2001-08-12T00:00"

    date_string = "Not a date"  # Should match nothing
    with pytest.raises(ValueError):
        parse_date_from_string(date_string)

    date_string = "Jann 1, 1999"  # Misspelling
    with pytest.raises(ValueError):
        parse_date_from_string(date_string)


def test_get_javascript_date():
    """Test that get_javascript_date converts datetime strings to JavaScript-compatible format."""

    assert get_javascript_date("2015-05-27 03:44:00") == "2015-05-27T00:00"
    assert get_javascript_date("2015-05-27") == "2015-05-27T00:00"
