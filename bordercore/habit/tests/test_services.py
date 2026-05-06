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
    """Test get_habit_detail returns at most 30 logs by default."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today() - timedelta(days=60))

    for i in range(35):
        HabitLog.objects.create(
            habit=habit, date=date.today() - timedelta(days=i), completed=True,
        )

    result = get_habit_detail(habit, user)

    assert len(result["logs"]) == 30


# -----------------------------------------------------------------------------
# Dashboard-redesign additions: unit, current_streak, last_value, recent_logs,
# longest_streak, days parameter on get_habit_detail.
# -----------------------------------------------------------------------------


def test_get_habit_list_includes_unit_when_set():
    user = UserFactory()
    HabitFactory(user=user, start_date=date.today(), unit="mg")

    result = get_habit_list(user)

    assert result[0]["unit"] == "mg"


def test_get_habit_list_unit_defaults_to_empty():
    user = UserFactory()
    HabitFactory(user=user, start_date=date.today())

    result = get_habit_list(user)

    assert result[0]["unit"] == ""


def test_get_habit_list_current_streak_zero_when_no_logs():
    user = UserFactory()
    HabitFactory(user=user, start_date=date.today())

    result = get_habit_list(user)

    assert result[0]["current_streak"] == 0


def test_get_habit_list_current_streak_counts_run_ending_today():
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today() - timedelta(days=10))
    for i in range(4):
        HabitLog.objects.create(
            habit=habit, date=date.today() - timedelta(days=i), completed=True,
        )

    result = get_habit_list(user)

    assert result[0]["current_streak"] == 4


def test_get_habit_list_current_streak_counts_run_ending_yesterday():
    """If today has no log yet, an unbroken run ending yesterday still counts."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today() - timedelta(days=10))
    for i in range(1, 4):  # yesterday, day-2, day-3
        HabitLog.objects.create(
            habit=habit, date=date.today() - timedelta(days=i), completed=True,
        )

    result = get_habit_list(user)

    assert result[0]["current_streak"] == 3


def test_get_habit_list_current_streak_breaks_on_missed_day():
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today() - timedelta(days=10))
    HabitLog.objects.create(habit=habit, date=date.today(), completed=True)
    HabitLog.objects.create(
        habit=habit, date=date.today() - timedelta(days=1), completed=False,
    )
    HabitLog.objects.create(
        habit=habit, date=date.today() - timedelta(days=2), completed=True,
    )

    result = get_habit_list(user)

    assert result[0]["current_streak"] == 1


def test_get_habit_list_current_streak_breaks_on_gap():
    """A day with no log row at all also breaks the streak."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today() - timedelta(days=10))
    HabitLog.objects.create(habit=habit, date=date.today(), completed=True)
    # Skip yesterday entirely.
    HabitLog.objects.create(
        habit=habit, date=date.today() - timedelta(days=2), completed=True,
    )

    result = get_habit_list(user)

    assert result[0]["current_streak"] == 1


def test_get_habit_list_last_value_is_most_recent():
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today() - timedelta(days=5))
    HabitLog.objects.create(
        habit=habit, date=date.today() - timedelta(days=3),
        completed=True, value="100",
    )
    HabitLog.objects.create(
        habit=habit, date=date.today() - timedelta(days=1),
        completed=True, value="250",
    )

    result = get_habit_list(user)

    assert result[0]["last_value"] == "250.00"


def test_get_habit_list_last_value_none_when_no_value_logs():
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())
    HabitLog.objects.create(habit=habit, date=date.today(), completed=True)

    result = get_habit_list(user)

    assert result[0]["last_value"] is None


def test_get_habit_list_recent_logs_returns_last_seven_days_oldest_first():
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today() - timedelta(days=14))
    # Log every other day going back two weeks.
    for i in (0, 2, 3, 5, 6):
        HabitLog.objects.create(
            habit=habit, date=date.today() - timedelta(days=i),
            completed=(i % 2 == 0),
        )

    result = get_habit_list(user)

    week = result[0]["recent_logs"]
    assert len(week) == 7
    # Oldest first → first entry is six days ago, last is today.
    assert week[0]["date"] == (date.today() - timedelta(days=6)).isoformat()
    assert week[-1]["date"] == date.today().isoformat()
    assert week[-1]["completed"] is True


def test_get_habit_list_recent_logs_unlogged_days_marked_completed_false():
    """Days within the 7-day window with no log row appear as completed=False."""
    user = UserFactory()
    HabitFactory(user=user, start_date=date.today() - timedelta(days=14))

    result = get_habit_list(user)

    week = result[0]["recent_logs"]
    assert all(d["completed"] is False for d in week)


def test_get_habit_detail_accepts_days_parameter():
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today() - timedelta(days=400))
    for i in range(400):
        HabitLog.objects.create(
            habit=habit, date=date.today() - timedelta(days=i), completed=True,
        )

    result = get_habit_detail(habit, user, days=365)

    assert len(result["logs"]) == 365


def test_get_habit_detail_includes_unit_and_streaks():
    user = UserFactory()
    habit = HabitFactory(
        user=user, start_date=date.today() - timedelta(days=10), unit="IU",
    )
    for i in range(3):
        HabitLog.objects.create(
            habit=habit, date=date.today() - timedelta(days=i), completed=True,
        )

    result = get_habit_detail(habit, user)

    assert result["unit"] == "IU"
    assert result["current_streak"] == 3
    assert result["longest_streak"] == 3


def test_get_habit_detail_longest_streak_tracks_historical_max():
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today() - timedelta(days=30))
    # Five-day run ending eight days ago, then a one-day current streak.
    for i in range(8, 13):
        HabitLog.objects.create(
            habit=habit, date=date.today() - timedelta(days=i), completed=True,
        )
    HabitLog.objects.create(habit=habit, date=date.today(), completed=True)

    result = get_habit_detail(habit, user)

    assert result["current_streak"] == 1
    assert result["longest_streak"] == 5
