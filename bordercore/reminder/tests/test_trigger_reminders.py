"""Unit tests for the trigger_reminders management command."""

from datetime import timedelta
from unittest.mock import patch

import pytest

from django.core.management import call_command
from django.utils import timezone

from accounts.tests.factories import UserFactory
from reminder.tests.factories import ReminderFactory
from todo.models import Todo

pytestmark = pytest.mark.django_db


def test_dry_run_finds_due_reminders_but_makes_no_changes():
    """With --dry-run, due reminders are found but DB is unchanged (no timestamps, no Todo)."""
    user = UserFactory(email="user@example.com")
    reminder = ReminderFactory(
        user=user,
        name="Dry Run Reminder",
        is_active=True,
        next_trigger_at=timezone.now() - timedelta(minutes=1),
    )
    last_triggered_before = reminder.last_triggered_at
    next_trigger_before = reminder.next_trigger_at

    with patch("reminder.management.commands.trigger_reminders.send_mail"):
        call_command("trigger_reminders", "--dry-run", verbosity=1)

    reminder.refresh_from_db()
    assert reminder.last_triggered_at == last_triggered_before
    assert reminder.next_trigger_at == next_trigger_before
    assert not Todo.objects.filter(name="Dry Run Reminder").exists()


def test_trigger_flow_updates_timestamps_and_sends_email():
    """When due, command updates last_triggered_at and next_trigger_at and sends email."""
    user = UserFactory(email="trigger@example.com")
    reminder = ReminderFactory(
        user=user,
        name="Trigger Me",
        is_active=True,
        next_trigger_at=timezone.now() - timedelta(minutes=1),
    )

    with patch("reminder.management.commands.trigger_reminders.send_mail") as mock_send_mail:
        call_command("trigger_reminders", verbosity=0)

    reminder.refresh_from_db()
    assert reminder.last_triggered_at is not None
    assert reminder.next_trigger_at is not None
    assert reminder.next_trigger_at > reminder.last_triggered_at
    mock_send_mail.assert_called_once()
    call_kwargs = mock_send_mail.call_args[1]
    assert call_kwargs["recipient_list"] == ["trigger@example.com"]
    assert "Trigger Me" in call_kwargs["subject"]


def test_trigger_creates_todo_when_create_todo_enabled():
    """When create_todo is True, triggering creates a Todo task."""
    user = UserFactory(email="todo@example.com")
    reminder = ReminderFactory(
        user=user,
        name="Create Todo Reminder",
        note="Optional note",
        is_active=True,
        create_todo=True,
        next_trigger_at=timezone.now() - timedelta(minutes=1),
    )

    with patch("reminder.management.commands.trigger_reminders.send_mail"):
        call_command("trigger_reminders", verbosity=0)

    todos = Todo.objects.filter(user=user, name="Create Todo Reminder")
    assert todos.count() == 1
    todo = todos.get()
    assert todo.note == "Optional note"
    assert todo.priority == 3


def test_trigger_does_not_create_todo_when_create_todo_disabled():
    """When create_todo is False, no Todo is created."""
    user = UserFactory(email="notodo@example.com")
    reminder = ReminderFactory(
        user=user,
        name="No Todo Reminder",
        is_active=True,
        create_todo=False,
        next_trigger_at=timezone.now() - timedelta(minutes=1),
    )

    with patch("reminder.management.commands.trigger_reminders.send_mail"):
        call_command("trigger_reminders", verbosity=0)

    assert not Todo.objects.filter(user=user, name="No Todo Reminder").exists()


def test_user_with_no_email_increments_failed_reminder_not_updated():
    """When user has no email, send_reminder_notification raises; reminder not updated."""
    user = UserFactory(email="")
    reminder = ReminderFactory(
        user=user,
        name="No Email Reminder",
        is_active=True,
        next_trigger_at=timezone.now() - timedelta(minutes=1),
    )
    last_before = reminder.last_triggered_at
    next_before = reminder.next_trigger_at

    call_command("trigger_reminders", verbosity=0)

    reminder.refresh_from_db()
    assert reminder.last_triggered_at == last_before
    assert reminder.next_trigger_at == next_before


def test_inactive_reminder_not_selected():
    """Inactive reminders are not selected even if next_trigger_at is in the past."""
    user = UserFactory(email="inactive@example.com")
    reminder = ReminderFactory(
        user=user,
        name="Inactive Reminder",
        is_active=False,
        next_trigger_at=timezone.now() - timedelta(minutes=1),
    )

    with patch("reminder.management.commands.trigger_reminders.send_mail") as mock_send_mail:
        call_command("trigger_reminders", verbosity=0)

    mock_send_mail.assert_not_called()
    reminder.refresh_from_db()
    assert reminder.last_triggered_at is None


def test_not_due_reminder_not_selected():
    """Reminders with next_trigger_at in the future are not selected."""
    user = UserFactory(email="future@example.com")
    reminder = ReminderFactory(
        user=user,
        name="Future Reminder",
        is_active=True,
        next_trigger_at=timezone.now() + timedelta(hours=1),
    )

    with patch("reminder.management.commands.trigger_reminders.send_mail") as mock_send_mail:
        call_command("trigger_reminders", verbosity=0)

    mock_send_mail.assert_not_called()
    reminder.refresh_from_db()
    assert reminder.last_triggered_at is None


def test_one_failure_others_still_processed():
    """When one reminder fails (e.g. no email), others are still triggered."""
    user_ok = UserFactory(username="user_ok_reminder", email="ok@example.com")
    user_no_email = UserFactory(username="user_no_email_reminder", email="")
    reminder_ok = ReminderFactory(
        user=user_ok,
        name="OK Reminder",
        is_active=True,
        next_trigger_at=timezone.now() - timedelta(minutes=1),
    )
    reminder_fail = ReminderFactory(
        user=user_no_email,
        name="Fail Reminder",
        is_active=True,
        next_trigger_at=timezone.now() - timedelta(minutes=1),
    )

    with patch("reminder.management.commands.trigger_reminders.send_mail"):
        call_command("trigger_reminders", verbosity=0)

    reminder_ok.refresh_from_db()
    reminder_fail.refresh_from_db()
    assert reminder_ok.last_triggered_at is not None
    assert reminder_fail.last_triggered_at is None
