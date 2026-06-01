"""Tests for the Google Calendar integration in ``lib.calendar_events``."""
from google.oauth2.credentials import Credentials

from accounts.models import UserProfile
from lib.calendar_events import Calendar

# A credential blob in the legacy oauth2client shape, as stored in the
# ``google_calendar`` JSONField. The migrated code must read this format.
SAMPLE_BLOB = {
    "access_token": "ya29.sample-access-token",
    "client_id": "sample-client-id.apps.googleusercontent.com",
    "client_secret": "sample-client-secret",
    "refresh_token": "1//sample-refresh-token",
    "token_expiry": "2026-01-01T00:00:00Z",
    "token_uri": "https://oauth2.googleapis.com/token",
    "user_agent": None,
    "revoke_uri": "https://oauth2.googleapis.com/revoke",
    "id_token": None,
    "token_response": {},
    "scopes": ["https://www.googleapis.com/auth/calendar"],
}


def test_calendar_maps_stored_blob_to_google_auth_credentials():
    """A stored oauth2client-style blob maps onto a google-auth Credentials."""
    profile = UserProfile(google_calendar=SAMPLE_BLOB,
                          google_calendar_email="user@example.com")
    calendar = Calendar(profile)

    assert calendar.has_credentials() is True
    assert isinstance(calendar.credentials, Credentials)
    assert calendar.credentials.token == SAMPLE_BLOB["access_token"]
    assert calendar.credentials.refresh_token == SAMPLE_BLOB["refresh_token"]
    assert calendar.credentials.client_id == SAMPLE_BLOB["client_id"]
    assert calendar.credentials.client_secret == SAMPLE_BLOB["client_secret"]
    assert calendar.credentials.token_uri == SAMPLE_BLOB["token_uri"]


def test_calendar_uses_scopes_from_stored_blob():
    """Credentials carry the scope the user actually granted, not a hardcoded one.

    The refresh token is bound to the scope granted at authorization time, so
    refreshing the access token with a narrower or different scope is rejected
    by Google as ``invalid_scope``. The stored scope must be used verbatim.
    """
    profile = UserProfile(google_calendar=SAMPLE_BLOB,
                          google_calendar_email="user@example.com")
    calendar = Calendar(profile)

    assert calendar.credentials.scopes == SAMPLE_BLOB["scopes"]


def test_calendar_without_stored_scopes_defaults_to_none():
    """A blob lacking a ``scopes`` key yields credentials with no scope set.

    Passing ``None`` lets google-auth refresh without narrowing the grant,
    which preserves the originally authorized scope.
    """
    blob = {k: v for k, v in SAMPLE_BLOB.items() if k != "scopes"}
    profile = UserProfile(google_calendar=blob,
                          google_calendar_email="user@example.com")
    calendar = Calendar(profile)

    assert calendar.credentials.scopes is None


def test_calendar_without_blob_has_no_credentials():
    """A profile with no stored blob yields a Calendar without credentials."""
    profile = UserProfile(google_calendar=None)
    calendar = Calendar(profile)

    assert calendar.has_credentials() is False
