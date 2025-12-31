"""
Management command to trigger reminders that are due.

This command queries for active reminders whose next_trigger_at is in the past
or present, sends notifications, and updates their last_triggered_at and
next_trigger_at timestamps.

Usage:
    python manage.py trigger_reminders

Options:
    --dry-run: Show what would be done without making changes.
    --verbosity: Control output verbosity (0-3).
"""

import logging
from argparse import ArgumentParser
from datetime import datetime, timedelta
from typing import Any

from reminder.models import Reminder

from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """Django management command to trigger due reminders.

    This command implements Option A (check frequently):
    - Queries reminders where is_active=True AND next_trigger_at <= now()
    - For each due reminder: sends notification, updates timestamps
    - Calculates next trigger time based on interval configuration
    - Handles errors gracefully, only updating on successful delivery

    Attributes:
        help: Help text for this command.
    """

    help = "Trigger reminders that are due for notifications"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Initialize the command."""
        super().__init__(*args, **kwargs)
        self.dry_run = False
        self.reminders_due = 0
        self.reminders_sent = 0
        self.reminders_failed = 0

    def add_arguments(self, parser: ArgumentParser) -> None:
        """Add command-line arguments."""
        parser.add_argument(
            "--dry-run",
            action="store_true",
            dest="dry_run",
            help="Show what would be done without making changes",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        """Handle command execution.

        Args:
            **options: Command options (dry_run, verbosity, etc.)
        """
        self.dry_run = options.get("dry_run", False)
        verbosity = int(options.get("verbosity", 1))

        self.find_and_trigger_reminders(verbosity)

        # Only print output if there were reminders to process
        if self.reminders_due > 0:
            if self.dry_run and verbosity >= 1:
                self.stdout.write(
                    self.style.WARNING("Running in DRY-RUN mode (no changes will be made)")
                )
            self.print_summary(verbosity)

    def find_and_trigger_reminders(self, verbosity: int) -> None:
        """Find all reminders that are due and trigger them.

        Args:
            verbosity: Output verbosity level (0-3).
        """
        now = timezone.now()

        # Query for active reminders that are due
        due_reminders = Reminder.objects.filter(
            is_active=True,
            next_trigger_at__lte=now,
        )

        self.reminders_due = due_reminders.count()

        if self.reminders_due > 0 and verbosity >= 1:
            self.stdout.write(f"Found {self.reminders_due} reminders due for triggering")

        for reminder in due_reminders:
            self.trigger_reminder(reminder, now, verbosity)

    def trigger_reminder(self, reminder: Reminder, now: datetime, verbosity: int) -> None:
        """Trigger a single reminder.

        Updates last_triggered_at and next_trigger_at only on successful
        notification delivery.

        Args:
            reminder: The Reminder object to trigger.
            now: Current datetime.
            verbosity: Output verbosity level.
        """
        try:
            # Send the notification (email for now)
            self.send_reminder_notification(reminder)

            if not self.dry_run:
                # Update timestamps only after successful notification
                reminder.last_triggered_at = now
                reminder.next_trigger_at = self.calculate_next_trigger(reminder, now)
                reminder.save()

            self.reminders_sent += 1

            if verbosity >= 2:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"✓ Triggered reminder '{reminder.name}' for user {reminder.user.username}"
                    )
                )

        except Exception as e:
            self.reminders_failed += 1
            error_msg = (
                f"✗ Failed to trigger reminder '{reminder.name}' "
                f"for user {reminder.user.username}: {str(e)}"
            )

            logger.exception(error_msg)

            if verbosity >= 1:
                self.stdout.write(self.style.ERROR(error_msg))

    def send_reminder_notification(self, reminder: Reminder) -> None:
        """Send a reminder notification to the user via email.

        Args:
            reminder: The Reminder object to notify about.

        Raises:
            Exception: If email sending fails.
        """
        user = reminder.user
        user_email = user.email

        if not user_email:
            raise ValueError(f"User {user.username} has no email address set")

        subject = f"Reminder: {reminder.name}"

        # Build email body
        body = f"""Hello {user.first_name or user.username},

This is your reminder: {reminder.name}

"""
        if reminder.note:
            body += f"Note: {reminder.note}\n\n"

        body += f"""Repeat interval: Every {reminder.interval_value} {reminder.interval_unit}(s)

---
Bordercore Reminder Service
"""

        try:
            send_mail(
                subject=subject,
                message=body,
                from_email="Admin <admin@bordercore.com>",
                recipient_list=[user_email],
                fail_silently=False,
            )
        except Exception as e:
            raise Exception(f"Failed to send email to {user_email}: {str(e)}")

    def calculate_next_trigger(self, reminder: Reminder, now: datetime) -> datetime:
        """Calculate the next trigger time for a reminder.

        Uses the interval configuration to determine when the reminder
        should trigger next.

        Args:
            reminder: The Reminder object.
            now: Current datetime.

        Returns:
            The next trigger datetime.
        """
        interval_unit = reminder.interval_unit
        interval_value = reminder.interval_value

        if interval_unit == Reminder.INTERVAL_UNIT_HOUR:
            delta = timedelta(hours=interval_value)
        elif interval_unit == Reminder.INTERVAL_UNIT_DAY:
            delta = timedelta(days=interval_value)
        elif interval_unit == Reminder.INTERVAL_UNIT_WEEK:
            delta = timedelta(weeks=interval_value)
        elif interval_unit == Reminder.INTERVAL_UNIT_MONTH:
            # Approximate: use 30 days for month
            delta = timedelta(days=30 * interval_value)
        else:
            # Fallback to daily
            delta = timedelta(days=1)

        return now + delta

    def print_summary(self, verbosity: int) -> None:
        """Print execution summary.

        Args:
            verbosity: Output verbosity level.
        """
        if verbosity >= 1:
            self.stdout.write("\n" + "=" * 50)
            self.stdout.write(
                self.style.SUCCESS(f"Reminders triggered: {self.reminders_sent}")
            )
            if self.reminders_failed > 0:
                self.stdout.write(
                    self.style.ERROR(f"Reminders failed: {self.reminders_failed}")
                )
            self.stdout.write("=" * 50)
