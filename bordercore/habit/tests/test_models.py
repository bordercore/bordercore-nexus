import pytest

from datetime import date, timedelta

from django.db import IntegrityError

from habit.models import Habit, HabitLog

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
