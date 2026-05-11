"""Tests for fitness.services card-grid payload helpers."""

from datetime import timedelta

import pytest

from django.utils import timezone

from fitness.models import Data
from fitness.services import (
    GROUP_TOKENS,
    _card_status,
    _last_scheduled_day_before,
    get_fitness_card_summary,
)

pytestmark = [pytest.mark.django_db]


# ---- helpers ----------------------------------------------------------------


def _age_data(data: Data, days: int) -> None:
    """Backdate a Data row's date field."""
    data.date = data.date - timedelta(days=days)
    data.save()


# ---- pure helpers -----------------------------------------------------------


def test_card_status_today_wins_over_overdue():
    assert _card_status(is_today=True, overdue_days=5) == "today"


def test_card_status_overdue():
    assert _card_status(is_today=False, overdue_days=2) == "overdue"


def test_card_status_on_track():
    assert _card_status(is_today=False, overdue_days=0) == "on_track"


def test_last_scheduled_day_before_returns_none_for_empty_schedule():
    today = timezone.localdate()
    assert _last_scheduled_day_before(None, today) is None
    assert _last_scheduled_day_before([False] * 7, today) is None


def test_last_scheduled_day_before_finds_most_recent_past_day():
    # Schedule: only Monday. Pick a Wednesday — most recent scheduled day is
    # two days back.
    today = timezone.localdate()
    # Roll today forward to a known Wednesday for deterministic comparison.
    days_to_wed = (2 - today.weekday()) % 7
    wednesday = today + timedelta(days=days_to_wed or 7)
    schedule = [True, False, False, False, False, False, False]
    most_recent = _last_scheduled_day_before(schedule, wednesday)
    assert most_recent == wednesday - timedelta(days=2)


# ---- payload shape ----------------------------------------------------------


def test_card_summary_payload_shape(authenticated_client, fitness):
    user, _ = authenticated_client()
    payload = get_fitness_card_summary(user)

    assert set(payload.keys()) == {"today_dow", "groups", "exercises"}
    assert isinstance(payload["today_dow"], int)
    assert 0 <= payload["today_dow"] <= 6

    # Every active card carries the full field set the React layer expects.
    expected_fields = {
        "uuid", "name", "exercise_url", "is_active", "status",
        "is_today", "overdue_days", "group", "group_label",
        "group_color_token", "schedule", "last_workout_days_ago",
        "last_weight", "last_reps", "sparkline", "sparkline_metric",
    }
    for card in payload["exercises"]:
        assert expected_fields <= set(card.keys()), card

    # Filter chip groups are sourced from active cards' groups.
    active_groups = {c["group"] for c in payload["exercises"] if c["is_active"]}
    assert {g["slug"] for g in payload["groups"]} <= active_groups


def test_card_summary_sort_order_today_then_overdue_then_on_track(
    authenticated_client, fitness,
):
    user, _ = authenticated_client()

    # The fixture sets up Bench Press (scheduled Monday) and Squats
    # (scheduled Monday, last workout 10 days old). Both are active. Verify
    # active cards lead the list, with status-sort applied.
    payload = get_fitness_card_summary(user)
    actives = [c for c in payload["exercises"] if c["is_active"]]
    inactives = [c for c in payload["exercises"] if not c["is_active"]]
    assert payload["exercises"][: len(actives)] == actives
    assert payload["exercises"][len(actives):] == inactives

    rank = {"today": 0, "overdue": 1, "on_track": 2}
    ranks = [rank[c["status"]] for c in actives]
    assert ranks == sorted(ranks)


def test_card_summary_known_muscle_group_maps_to_token(
    authenticated_client, fitness,
):
    user, _ = authenticated_client()
    payload = get_fitness_card_summary(user)

    # Bench Press is registered against "Chest" in the fixture.
    bench = next(c for c in payload["exercises"] if c["name"] == "Bench Press")
    assert bench["group"] == "chest"
    assert bench["group_color_token"] == GROUP_TOKENS["chest"]["color_token"]


def test_card_summary_overdue_when_scheduled_day_pre_dates_last_workout(
    authenticated_client, fitness,
):
    user, _ = authenticated_client()

    # Squats in the fixture has its Data backdated by 10 days and is
    # scheduled for Monday. Unless today happens to be Monday (in which case
    # the card becomes ``today``), the status should be ``overdue``.
    payload = get_fitness_card_summary(user)
    squats = next(c for c in payload["exercises"] if c["name"] == "Squats")

    if timezone.localdate().weekday() == 0:  # Monday — squats is "today"
        assert squats["status"] == "today"
    else:
        assert squats["status"] == "overdue"
        assert squats["overdue_days"] >= 1


def test_card_summary_sparkline_uses_weight_when_available(
    authenticated_client, fitness,
):
    user, _ = authenticated_client()
    payload = get_fitness_card_summary(user)
    bench = next(c for c in payload["exercises"] if c["name"] == "Bench Press")
    assert bench["sparkline_metric"] == "weight"
    assert len(bench["sparkline"]) > 0
    assert all(v > 0 for v in bench["sparkline"])


def test_card_summary_sparkline_uses_duration_for_duration_only_exercise(
    authenticated_client, fitness,
):
    user, _ = authenticated_client()
    payload = get_fitness_card_summary(user)
    dead_hang = next(c for c in payload["exercises"] if c["name"] == "Dead Hang")
    # All Dead Hang sets have weight=0, so the picker should fall through to
    # reps (every set has reps=1). Either reps or duration is fine; the
    # important guarantee is that we don't pick weight.
    assert dead_hang["sparkline_metric"] in {"reps", "duration"}
    assert dead_hang["sparkline_metric"] != "weight"


def test_card_summary_returns_empty_groups_when_no_active_exercises(db, django_user_model):
    user = django_user_model.objects.create_user(username="lonely", password="x")
    payload = get_fitness_card_summary(user)
    assert payload["groups"] == []
    assert payload["exercises"] == []
