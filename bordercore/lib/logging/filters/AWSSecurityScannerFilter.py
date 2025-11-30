"""Logging filter for excluding AWS Security Scanner requests.

This module provides a Django logging filter that filters out log records
from AWS Security Scanner requests to reduce noise in application logs.
"""

import logging
from typing import Any


class AWSSecurityScannerFilter(logging.Filter):
    """Filter that excludes log records from AWS Security Scanner requests.

    This filter checks the HTTP_USER_AGENT header and filters out any log
    records originating from AWS Security Scanner, preventing these automated
    security scans from cluttering application logs.
    """

    def filter(self, record: Any) -> bool:
        """Filter log records based on the request's user agent.

        Checks if the log record's request has a user agent matching
        "AWS Security Scanner" and filters it out if found.

        Args:
            record: LogRecord instance containing request information.

        Returns:
            False if the record is from AWS Security Scanner, True otherwise.
        """
        if record.request.META.get("HTTP_USER_AGENT", None) == "AWS Security Scanner":
            return False

        return True
