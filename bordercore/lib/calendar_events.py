"""Google Calendar integration for retrieving upcoming events for a user.

This module defines the `Calendar` class, which interfaces with the Google
Calendar API using OAuth2 credentials stored in a `UserProfile`. It retrieves
a user's calendar events for the next 7 days, parsing and formatting event
metadata into a simplified list of dictionaries.
"""

import logging
from datetime import timedelta
from typing import Any, Dict, List, Optional, TypedDict, cast

import dateutil.parser
import httplib2
from apiclient.discovery import build
from oauth2client.client import OAuth2Credentials
from rfc3339 import datetimetostr
from rfc3339 import now as now_rfc3339

from django.utils import timezone

from accounts.models import UserProfile

logger = logging.getLogger(f"bordercore.{__name__}")


class EventDict(TypedDict, total=False):
    """Structured representation of a single calendar event.

    This dictionary includes both raw and formatted metadata for an event,
    such as timing, description, and location, as returned from the Google Calendar API.

    Fields:
        count: Integer index of the event in the returned list.
        description: Optional event description.
        location: Optional physical or virtual location of the event.
        summary: Optional short summary or title of the event.
        start_raw: ISO 8601 string representing the raw start time/date.
        start_pretty: Human-friendly version of the start time (e.g., "Tue 03:00PM").
        end_raw: ISO 8601 string representing the raw end time/date.
        end_pretty: Human-friendly version of the end time (e.g., "Tue 04:00PM").
    """
    count: int
    description: str
    location: str
    summary: str
    start_raw: str
    start_pretty: str
    end_raw: str
    end_pretty: str

class Calendar():
    """Handles Google Calendar access and event retrieval for a user."""

    credentials = None

    def __init__(self, user_profile: UserProfile) -> None:
        """Initializes the Calendar with the user's Google OAuth2 credentials.

        Args:
            user_profile: A UserProfile instance containing Google Calendar auth data.

        Raises:
            ValueError: If the argument is not a UserProfile instance.
        """
        if not isinstance(user_profile, UserProfile):
            raise ValueError("Calendar must be passed a UserProfile instance")
        self.calendar_email: Optional[str] = user_profile.google_calendar_email
        cal_info = user_profile.google_calendar
        if cal_info:
            self.credentials = OAuth2Credentials(
                cal_info["access_token"],
                cal_info["client_id"],
                cal_info["client_secret"],
                cal_info["refresh_token"],
                cal_info["token_expiry"],
                cal_info["token_uri"],
                cal_info["user_agent"],
                cal_info["revoke_uri"],
                cal_info["id_token"],
                cal_info["token_response"],
            )

    def has_credentials(self) -> bool:
        """Checks whether valid OAuth2 credentials are present.

        Returns:
            True if credentials exist; False otherwise.
        """
        return bool(self.credentials)

    def _parse_event_time(self, time_info: Dict[str, str]) -> tuple[str, str]:
        """Parses and formats event start/end times from the Google Calendar event structure.

        Args:
            time_info: Dictionary containing either a "dateTime" or "date" field.

        Returns:
            A tuple of the raw time string and a pretty-printed version (e.g., "Mon 10:30AM").
        """
        if "dateTime" in time_info:
            raw = time_info["dateTime"]
        else:
            raw = time_info["date"]
        pretty = dateutil.parser.parse(raw).strftime("%a %I:%M%p")
        return raw, pretty

    def get_calendar_info(self) -> List[EventDict]:
        """Fetches upcoming events for the next 7 days from the user's calendar.

        Returns:
            A list of dictionaries, each representing an event with fields like:
            count, summary, description, location, start_raw, start_pretty, end_raw, end_pretty.
        """
        if not self.credentials:
            logger.warning("No credentials available for calendar access.")
            return []

        if not self.calendar_email:
            logger.warning("No Google Calendar email configured for user profile.")
            return []

        http = httplib2.Http()
        http = self.credentials.authorize(http)
        service = build(serviceName="calendar", version="v3", http=http, cache_discovery=False)
        time_max = timezone.now() + timedelta(days=7)

        events = service.events().list(calendarId=self.calendar_email,
                                       orderBy="startTime",
                                       singleEvents=True,
                                       timeMin=str(now_rfc3339()).replace(" ", "T"),
                                       timeMax=datetimetostr(time_max)).execute()
        event_list: List[EventDict] = []
        for count, e in enumerate(events.get("items", []), start=1):
            one_event: EventDict = {"count": count}
            for field in ["description", "location", "summary"]:
                value = e.get(field)
                if value:
                    cast(Dict[str, Any], one_event)[field] = value
            one_event["start_raw"], one_event["start_pretty"] = self._parse_event_time(e["start"])
            one_event["end_raw"], one_event["end_pretty"] = self._parse_event_time(e["end"])
            event_list.append(one_event)

        return event_list
