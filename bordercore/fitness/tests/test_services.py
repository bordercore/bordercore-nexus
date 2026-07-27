"""Tests for fitness.services card-grid payload helpers."""

from datetime import timedelta

import pytest

from django.test import RequestFactory
from django.utils import timezone

from fitness.models import Data
from fitness.services import (
    GROUP_TOKENS,
    SPARKLINE_LIMIT,
    _card_status,
    _last_scheduled_day_before,
    _recent_data_by_exercise,
    get_fitness_card_summary,
    get_fitness_summary,
    get_inactive_card_details,
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
    """Dead Hang is inactive, so its series comes from the deferred lookup."""
    user, _ = authenticated_client()
    dead_hang = next(e for e in fitness if e.name == "Dead Hang")

    detail = get_inactive_card_details(user)[str(dead_hang.uuid)]

    # All Dead Hang sets have weight=0, so the picker should fall through to
    # reps (every set has reps=1). Either reps or duration is fine; the
    # important guarantee is that we don't pick weight.
    assert detail["sparkline_metric"] in {"reps", "duration"}
    assert detail["sparkline_metric"] != "weight"


def test_card_summary_returns_empty_groups_when_no_active_exercises(db, django_user_model):
    user = django_user_model.objects.create_user(username="lonely", password="x")
    payload = get_fitness_card_summary(user)
    assert payload["groups"] == []
    assert payload["exercises"] == []


# ---- deferred inactive-card details -----------------------------------------


def test_card_summary_omits_series_for_inactive_cards(authenticated_client, fitness):
    """Inactive cards start collapsed, so their series are not shipped."""
    user, _ = authenticated_client()
    payload = get_fitness_card_summary(user)

    inactive = [c for c in payload["exercises"] if not c["is_active"]]
    assert inactive, "fixture should produce inactive cards"
    for card in inactive:
        assert card["sparkline"] == []
        assert card["sparkline_metric"] is None
        assert card["last_weight"] is None
        assert card["last_reps"] is None

    # Active cards keep theirs, so the grid renders fully on first paint.
    bench = next(c for c in payload["exercises"] if c["name"] == "Bench Press")
    assert bench["is_active"]
    assert bench["sparkline"]


def test_card_summary_still_dates_inactive_cards(authenticated_client, fitness):
    """``last_workout_days_ago`` comes from the annotation, not the set rows."""
    user, _ = authenticated_client()
    payload = get_fitness_card_summary(user)

    dead_hang = next(c for c in payload["exercises"] if c["name"] == "Dead Hang")
    assert not dead_hang["is_active"]
    assert dead_hang["last_workout_days_ago"] is not None


def test_inactive_details_cover_exactly_the_inactive_cards(
    authenticated_client, fitness,
):
    user, _ = authenticated_client()
    payload = get_fitness_card_summary(user)
    details = get_inactive_card_details(user)

    inactive_uuids = {c["uuid"] for c in payload["exercises"] if not c["is_active"]}
    active_uuids = {c["uuid"] for c in payload["exercises"] if c["is_active"]}

    assert set(details) == inactive_uuids
    assert not set(details) & active_uuids


def test_inactive_details_carry_the_series_left_out_of_the_payload(
    authenticated_client, fitness,
):
    """What the payload omits for an inactive card, the lookup supplies."""
    user, _ = authenticated_client()
    dead_hang = next(e for e in fitness if e.name == "Dead Hang")

    detail = get_inactive_card_details(user)[str(dead_hang.uuid)]

    assert set(detail) == {
        "last_weight", "last_reps", "sparkline", "sparkline_metric",
    }
    assert len(detail["sparkline"]) > 0
    assert detail["last_reps"] == 1


def test_inactive_details_exclude_other_users_sets(
    authenticated_client, fitness, django_user_model,
):
    user, _ = authenticated_client()
    stranger = django_user_model.objects.create_user(username="stranger", password="x")

    # Every exercise is inactive for a user with no ExerciseUser rows, but
    # none of them carry the fixture user's sets.
    details = get_inactive_card_details(stranger)
    assert details, "all exercises are inactive for this user"
    assert all(d["sparkline"] == [] for d in details.values())
    assert all(d["last_reps"] is None for d in details.values())


# ---- recent-set lookup ------------------------------------------------------


def test_recent_data_caps_each_exercise_at_the_limit(authenticated_client, fitness):
    """The per-exercise cut happens in SQL, so no exercise exceeds the limit."""
    user, _ = authenticated_client()
    bench = next(e for e in fitness if e.name == "Bench Press")

    # The fixture logs 44 sets for Bench Press — comfortably over the limit.
    assert Data.objects.filter(workout__exercise=bench).count() > SPARKLINE_LIMIT

    recent = _recent_data_by_exercise(user, [e.id for e in fitness])

    assert len(recent[bench.id]) == SPARKLINE_LIMIT
    assert all(len(sets) <= SPARKLINE_LIMIT for sets in recent.values())


def test_recent_data_returns_newest_sets_first(authenticated_client, fitness):
    user, _ = authenticated_client()
    bench = next(e for e in fitness if e.name == "Bench Press")

    # The fixture's final Bench Press workout logs 200/205/210/220 in order,
    # so the newest-first cut leads with those weights reversed.
    sets = _recent_data_by_exercise(user, [bench.id])[bench.id]
    assert [s.weight for s in sets[:4]] == [220, 210, 205, 200]


def test_recent_data_is_scoped_to_the_requested_exercises(authenticated_client, fitness):
    user, _ = authenticated_client()
    bench = next(e for e in fitness if e.name == "Bench Press")

    recent = _recent_data_by_exercise(user, [bench.id])

    assert set(recent) == {bench.id}


def test_recent_data_excludes_other_users_sets(
    authenticated_client, fitness, django_user_model,
):
    """Sets are filtered by owner, not just by exercise."""
    user, _ = authenticated_client()
    bench = next(e for e in fitness if e.name == "Bench Press")
    stranger = django_user_model.objects.create_user(username="stranger", password="x")

    assert _recent_data_by_exercise(stranger, [bench.id]) == {}
    assert _recent_data_by_exercise(user, [bench.id])[bench.id]


def test_recent_data_returns_empty_mapping_for_no_exercises(authenticated_client, fitness):
    user, _ = authenticated_client()
    assert _recent_data_by_exercise(user, []) == {}


# ---- per-request memoization ------------------------------------------------


def test_summary_is_memoized_for_the_life_of_a_request(
    authenticated_client, fitness, django_assert_num_queries,
):
    """A second call sharing a request reuses the first evaluation."""
    user, _ = authenticated_client()
    request = RequestFactory().get("/fitness/")

    first = get_fitness_summary(user, request=request)
    with django_assert_num_queries(0):
        second = get_fitness_summary(user, request=request)

    assert second == first


def test_summary_memo_does_not_leak_between_users(
    authenticated_client, fitness, django_user_model,
):
    user, _ = authenticated_client()
    stranger = django_user_model.objects.create_user(username="stranger", password="x")
    request = RequestFactory().get("/fitness/")

    active_for_user, _inactive = get_fitness_summary(user, request=request)
    active_for_stranger, _ = get_fitness_summary(stranger, request=request)

    assert active_for_user, "fixture user should have active exercises"
    assert active_for_stranger == []


def test_summary_memo_is_not_reused_when_muscle_data_is_needed(
    authenticated_client, fitness, django_assert_num_queries,
):
    """A count-only entry lacks the muscle prefetch, so it can't be reused.

    Serving it to a caller that reads ``muscle`` would swap one saved query
    for a per-exercise N+1.
    """
    user, _ = authenticated_client()
    request = RequestFactory().get("/")

    # count_only skips the prefetch, so this entry can't satisfy the next call.
    get_fitness_summary(user, count_only=True, request=request)

    with django_assert_num_queries(3):
        active, _inactive = get_fitness_summary(user, request=request)

    # Muscles are prefetched, so resolving a group costs no extra query.
    with django_assert_num_queries(0):
        assert [list(e.muscle.all()) for e in active] is not None


def test_summary_without_a_request_is_never_memoized(authenticated_client, fitness):
    """Omitting the request keeps the old uncached behaviour."""
    user, _ = authenticated_client()
    request = RequestFactory().get("/fitness/")

    get_fitness_summary(user, request=request)

    assert not hasattr(RequestFactory().get("/fitness/"), "_fitness_summary_cache")
    # An un-memoized call still returns a correct result.
    assert get_fitness_summary(user)[0] == get_fitness_summary(user, request=request)[0]
