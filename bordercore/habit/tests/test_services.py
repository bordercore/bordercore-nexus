from datetime import date, datetime, time, timedelta

import pytest

from django.utils import timezone

from accounts.tests.factories import UserFactory
from habit.models import HabitLog, HabitNote
from habit.services import add_habit_note, get_habit_detail, get_habit_list, serialize_note
from habit.tests.factories import HabitFactory
from habit.tests.utils import set_note_clock_time, set_note_created

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

    result = get_habit_detail(habit)

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

    result = get_habit_detail(habit)

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

    result = get_habit_detail(habit, days=365)

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

    result = get_habit_detail(habit)

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

    result = get_habit_detail(habit)

    assert result["current_streak"] == 1
    assert result["longest_streak"] == 5


# -----------------------------------------------------------------------------
# Habit notes: many free-text observations per habit per day.
# -----------------------------------------------------------------------------


def test_add_habit_note_creates_a_note():
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())

    note = add_habit_note(habit, date.today(), "Took it with breakfast")

    assert note is not None
    assert note.note == "Took it with breakfast"
    assert note.date == date.today()
    assert HabitNote.objects.filter(habit=habit).count() == 1


def test_add_habit_note_strips_surrounding_whitespace():
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())

    note = add_habit_note(habit, date.today(), "  padded  ")

    assert note.note == "padded"


@pytest.mark.parametrize("blank", ["", "   ", "\n\t "])
def test_add_habit_note_ignores_blank_text(blank):
    """Blank input creates nothing, so an empty log-panel note box is a no-op."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())

    note = add_habit_note(habit, date.today(), blank)

    assert note is None
    assert not HabitNote.objects.filter(habit=habit).exists()


def test_add_habit_note_appends_rather_than_replacing():
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())

    add_habit_note(habit, date.today(), "first")
    add_habit_note(habit, date.today(), "second")

    assert HabitNote.objects.filter(habit=habit, date=date.today()).count() == 2


def test_add_habit_note_works_on_a_day_with_no_log():
    """Notes are independent of HabitLog, so no log row is created."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today() - timedelta(days=5))
    unlogged_day = date.today() - timedelta(days=3)

    add_habit_note(habit, unlogged_day, "felt awful, skipped it")

    assert HabitNote.objects.filter(habit=habit, date=unlogged_day).count() == 1
    assert not HabitLog.objects.filter(habit=habit, date=unlogged_day).exists()


def test_serialize_note_reports_local_clock_time_for_a_same_day_note():
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())
    note = HabitNote.objects.create(habit=habit, date=date.today(), note="8am dose")
    set_note_clock_time(note, 8, 14)
    note.refresh_from_db()

    result = serialize_note(note)

    assert result["time"] == "8:14 AM"
    assert result["note"] == "8am dose"
    assert result["date"] == date.today().isoformat()


def test_serialize_note_uses_local_time_not_utc_near_midnight():
    """A 9pm ET note is stored as 01:00 UTC the next day; it must still read 9pm.

    Comparing the raw UTC timestamp would both show the wrong hour and
    misclassify the note as written on a later date.
    """
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())
    note = HabitNote.objects.create(habit=habit, date=date.today(), note="late one")
    set_note_clock_time(note, 21)
    note.refresh_from_db()

    result = serialize_note(note)

    assert result["time"] == "9:00 PM"


def test_serialize_note_omits_time_when_written_on_a_later_date():
    """Backfilling a past day carries today's clock, which would be misleading."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today() - timedelta(days=5))
    past_day = date.today() - timedelta(days=3)
    note = HabitNote.objects.create(habit=habit, date=past_day, note="remembered later")
    set_note_created(note, timezone.make_aware(datetime.combine(date.today(), time(10, 0))))
    note.refresh_from_db()

    result = serialize_note(note)

    assert result["time"] is None


def test_get_habit_detail_includes_notes_newest_day_first():
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today() - timedelta(days=10))
    older = HabitNote.objects.create(
        habit=habit, date=date.today() - timedelta(days=2), note="older",
    )
    newer = HabitNote.objects.create(habit=habit, date=date.today(), note="newer")
    set_note_clock_time(older, 9)
    set_note_clock_time(newer, 9)

    result = get_habit_detail(habit)

    assert [n["note"] for n in result["notes"]] == ["newer", "older"]


def test_get_habit_detail_notes_respect_the_day_window():
    """Notes outside the requested window are excluded, like logs."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today() - timedelta(days=400))
    HabitNote.objects.create(habit=habit, date=date.today(), note="inside")
    HabitNote.objects.create(
        habit=habit, date=date.today() - timedelta(days=100), note="outside",
    )

    result = get_habit_detail(habit, days=30)

    assert [n["note"] for n in result["notes"]] == ["inside"]


def test_get_habit_detail_log_entries_no_longer_carry_a_note():
    """Notes moved off HabitLog; the frontend reads them from `notes` instead."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())
    HabitLog.objects.create(habit=habit, date=date.today(), completed=True)

    result = get_habit_detail(habit)

    assert "note" not in result["logs"][0]
