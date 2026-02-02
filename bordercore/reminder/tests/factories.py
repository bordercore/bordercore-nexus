from datetime import time

import factory

from accounts.tests.factories import UserFactory
from reminder.models import Reminder


class ReminderFactory(factory.django.DjangoModelFactory):
    """Factory for Reminder with sensible defaults for testing."""

    class Meta:
        model = Reminder

    name = factory.Sequence(lambda n: f"Reminder {n}")
    user = factory.SubFactory(UserFactory)
    schedule_type = Reminder.SCHEDULE_TYPE_DAILY
    trigger_time = time(9, 0)
    is_active = True
    days_of_week = []
    days_of_month = []
