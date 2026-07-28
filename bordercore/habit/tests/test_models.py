import pytest

from datetime import date, timedelta

from django.db import IntegrityError

from habit.models import Habit, HabitLog, HabitNote
from habit.tests.factories import HabitFactory
from habit.tests.utils import set_note_clock_time

pytestmark = [pytest.mark.django_db]


def test_habit_str(habit):

    assert str(habit) == "habit_0"


def test_habit_is_active_no_end_date(habit):

    assert habit.end_date is None
    assert habit.is_active is True


def test_habit_is_active_future_end_date(habit):

    habit.end_date = date.today() + timedelta(days=7)
    habit.save()

    assert habit.is_active is True


def test_habit_is_active_today_end_date(habit):

    habit.end_date = date.today()
    habit.save()

    assert habit.is_active is True


def test_habit_is_inactive_past_end_date(habit):

    habit.end_date = date.today() - timedelta(days=1)
    habit.save()

    assert habit.is_active is False


def test_habit_log_str(habit):

    done_log = HabitLog.objects.create(
        habit=habit, date=date.today() + timedelta(days=10), completed=True,
    )
    assert "done" in str(done_log)

    missed_log = HabitLog.objects.create(
        habit=habit, date=date.today() + timedelta(days=11), completed=False,
    )
    assert "missed" in str(missed_log)


def test_habit_log_unique_constraint(habit):

    with pytest.raises(IntegrityError):
        HabitLog.objects.create(
            habit=habit,
            date=date.today(),
            completed=False,
        )


def test_habit_note_ordering_is_newest_day_first_chronological_within_day():
    """Notes sort by date descending, but oldest-first inside a single day."""
    # Built standalone rather than from the `habit` fixture, which seeds its
    # own note and would blur an assertion about exact ordering.
    habit = HabitFactory(start_date=date.today() - timedelta(days=5))
    today = date.today()

    # Inserted out of order on purpose: if ordering fell back to insertion
    # order or pk, "2pm" would come first within today.
    afternoon = HabitNote.objects.create(habit=habit, date=today, note="2pm")
    morning = HabitNote.objects.create(habit=habit, date=today, note="8am")
    HabitNote.objects.create(
        habit=habit, date=today - timedelta(days=1), note="yesterday",
    )

    set_note_clock_time(morning, 8)
    set_note_clock_time(afternoon, 14)

    notes = HabitNote.objects.filter(habit=habit)

    assert [n.note for n in notes] == ["8am", "2pm", "yesterday"]


def test_habit_note_allows_many_per_day():
    """The whole point: no unique constraint on (habit, date)."""
    habit = HabitFactory(start_date=date.today())
    today = date.today()

    HabitNote.objects.create(habit=habit, date=today, note="first")
    HabitNote.objects.create(habit=habit, date=today, note="second")

    assert HabitNote.objects.filter(habit=habit, date=today).count() == 2


def test_habit_note_deleted_with_habit():
    """Notes cascade when their habit goes away."""
    habit = HabitFactory(start_date=date.today())
    HabitNote.objects.create(habit=habit, date=date.today(), note="gone soon")
    habit_id = habit.pk

    habit.delete()

    assert not HabitNote.objects.filter(habit_id=habit_id).exists()


def test_habit_manager_active(habit):

    active = Habit.objects.active(habit.user)
    assert habit in active

    # The second habit created in the fixture has a past end_date
    inactive_habits = Habit.objects.filter(
        user=habit.user,
        end_date__lt=date.today(),
    )
    for h in inactive_habits:
        assert h not in active


def test_habit_manager_with_log_counts(habit):

    habits = Habit.objects.with_log_counts(habit.user)
    annotated = habits.get(pk=habit.pk)

    assert annotated.total_logs == 2
    assert annotated.completed_logs == 1
