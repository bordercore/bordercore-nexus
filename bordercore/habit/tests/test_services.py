from datetime import date, timedelta

import pytest

from accounts.tests.factories import UserFactory
from habit.models import HabitLog
from habit.services import get_habit_detail, get_habit_list
from habit.tests.factories import HabitFactory

pytestmark = [pytest.mark.django_db]


def test_get_habit_list_returns_habits():
    """Test get_habit_list returns serialized habit data."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())

    result = get_habit_list(user)

    assert len(result) == 1
    assert result[0]["uuid"] == str(habit.uuid)
    assert result[0]["name"] == habit.name
    assert result[0]["is_active"] is True


def test_get_habit_list_completed_today():
    """Test completed_today reflects today's log status."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())
    HabitLog.objects.create(habit=habit, date=date.today(), completed=True)

    result = get_habit_list(user)

    assert result[0]["completed_today"] is True


def test_get_habit_list_not_completed_today():
    """Test completed_today is False when no log exists for today."""
    user = UserFactory()
    HabitFactory(user=user, start_date=date.today())

    result = get_habit_list(user)

    assert result[0]["completed_today"] is False


def test_get_habit_list_log_counts():
    """Test total_logs and completed_logs annotations."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())
    HabitLog.objects.create(habit=habit, date=date.today(), completed=True)
    HabitLog.objects.create(
        habit=habit, date=date.today() - timedelta(days=1), completed=False,
    )

    result = get_habit_list(user)

    assert result[0]["total_logs"] == 2
    assert result[0]["completed_logs"] == 1


def test_get_habit_detail_returns_data():
    """Test get_habit_detail returns habit info with logs."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())
    HabitLog.objects.create(habit=habit, date=date.today(), completed=True)

    result = get_habit_detail(habit, user)

    assert result["uuid"] == str(habit.uuid)
    assert result["name"] == habit.name
    assert len(result["logs"]) == 1
    assert result["logs"][0]["completed"] is True


def test_get_habit_detail_limits_logs():
    """Test get_habit_detail returns at most 30 logs."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today() - timedelta(days=60))

    for i in range(35):
        HabitLog.objects.create(
            habit=habit, date=date.today() - timedelta(days=i), completed=True,
        )

    result = get_habit_detail(habit, user)

    assert len(result["logs"]) == 30
