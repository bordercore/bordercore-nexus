"""Tests for the reminder services helpers."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from django.utils import timezone

from accounts.tests.factories import UserFactory
from reminder.services import notify_reminder_fired
from reminder.tests.factories import ReminderFactory

pytestmark = [pytest.mark.django_db]


def test_notify_reminder_fired_calls_group_send_with_expected_payload():
    user = UserFactory(username="notify_user", email="notify@example.com")
    reminder = ReminderFactory(
        user=user,
        name="Pay rent",
        note="Use Zelle",
    )
    fired_at = datetime(2026, 5, 22, 14, 0, 0, tzinfo=timezone.get_current_timezone())

    mock_layer = MagicMock()
    mock_layer.group_send = AsyncMock()
    with patch("reminder.services.get_channel_layer", return_value=mock_layer):
        notify_reminder_fired(reminder, fired_at)

    mock_layer.group_send.assert_called_once()
    group, message = mock_layer.group_send.call_args.args
    assert group == f"reminders.user.{user.id}"
    assert message["type"] == "reminder.fired"
    payload = message["reminder"]
    assert payload["uuid"] == str(reminder.uuid)
    assert payload["name"] == "Pay rent"
    assert payload["note"] == "Use Zelle"
    assert payload["fired_at"] == fired_at.isoformat()


def test_notify_reminder_fired_handles_none_note():
    user = UserFactory(username="notify_user2", email="notify2@example.com")
    reminder = ReminderFactory(user=user, name="No note reminder", note=None)
    fired_at = timezone.now()

    mock_layer = MagicMock()
    mock_layer.group_send = AsyncMock()
    with patch("reminder.services.get_channel_layer", return_value=mock_layer):
        notify_reminder_fired(reminder, fired_at)

    _, message = mock_layer.group_send.call_args.args
    assert message["reminder"]["note"] == ""


def test_notify_reminder_fired_swallows_channel_layer_exceptions():
    """Channel-layer outage must never propagate — reminder triggers must succeed."""
    user = UserFactory(username="notify_user3", email="notify3@example.com")
    reminder = ReminderFactory(user=user, name="Resilient")

    with patch("reminder.services.get_channel_layer", side_effect=RuntimeError("redis down")):
        # Should not raise
        notify_reminder_fired(reminder, timezone.now())


def test_notify_reminder_fired_noop_when_no_channel_layer():
    """When channel layers aren't configured, get_channel_layer() returns None."""
    user = UserFactory(username="notify_user4", email="notify4@example.com")
    reminder = ReminderFactory(user=user, name="No layer")

    with patch("reminder.services.get_channel_layer", return_value=None):
        notify_reminder_fired(reminder, timezone.now())
