import pytest

from datetime import date, timedelta

from habit.models import HabitLog
from habit.tests.factories import HabitFactory
from tag.tests.factories import TagFactory


@pytest.fixture()
def habit():

    TagFactory.reset_sequence(0)
    HabitFactory.reset_sequence(0)

    habit_1 = HabitFactory(start_date=date.today() - timedelta(days=30))
    habit_2 = HabitFactory(
        start_date=date.today() - timedelta(days=60),
        end_date=date.today() - timedelta(days=1),
    )

    tag_1 = TagFactory()
    tag_2 = TagFactory()

    habit_1.tags.add(tag_1)
    habit_1.tags.add(tag_2)

    # Add sample logs for habit_1
    HabitLog.objects.create(habit=habit_1, date=date.today(), completed=True)
    HabitLog.objects.create(
        habit=habit_1,
        date=date.today() - timedelta(days=1),
        completed=False,
        note="Skipped",
    )

    yield habit_1
