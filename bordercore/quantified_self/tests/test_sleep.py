"""Sleep durations, stage overlap, provenance, and independently logged presses."""
from datetime import date, datetime, timedelta

import pytest
from django.contrib.auth.models import User
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from quantified_self import apple_health, sleep
from quantified_self.models import ImportBatch, SleepInterval, SleepSession
from quantified_self.services import save_record, source_for
from .test_apple_health import export, record

DAY = date(2026, 1, 10)


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="sleep-owner")


def interval(owner, start="2026-01-09T23:00:00-05:00", end="2026-01-10T07:00:00-05:00", stage="asleep", source="Watch", **extra):
    return SleepInterval.objects.create(user=owner, source=source_for(owner, source),
        **sleep.normalize_interval({"start": start, "end": end, "stage": stage}), **extra)


def session(owner, version, duration, start="2026-01-09T23:00:00-05:00", end="2026-01-10T07:00:00-05:00", **extra):
    return SleepSession.objects.create(user=owner, source=source_for(owner, "Watch"), date=DAY,
        started_at=datetime.fromisoformat(start), ended_at=datetime.fromisoformat(end),
        asleep_seconds=duration, algorithm_version=version, **extra)


def test_stages_override_unspecified_sleep_without_double_counting(owner):
    interval(owner, stage="in_bed")
    interval(owner)
    interval(owner)  # overlapping export without an ID
    interval(owner, start="2026-01-10T01:00:00-05:00", end="2026-01-10T02:00:00-05:00", stage="deep")
    interval(owner, start="2026-01-10T02:00:00-05:00", end="2026-01-10T02:15:00-05:00", stage="awake")
    day = sleep.dashboard(owner, DAY, DAY, detail=True)["days"][0]
    assert day["asleep_seconds"] == 7.75 * 3600
    assert day["stages"]["deep"] == 3600
    assert day["stages"]["awake"] == 900
    assert day["stages"]["in_bed"] == 8 * 3600
    assert sum(day["stages"][stage] for stage in sleep.ASLEEP) == day["asleep_seconds"]
    assert day["duration_basis"] == "stages"


def test_conflicting_specific_stages_become_unspecified(owner):
    interval(owner, stage="light")
    interval(owner, stage="deep")
    day = sleep.dashboard(owner, DAY, DAY)["days"][0]
    assert day["stages"]["light"] == day["stages"]["deep"] == 0
    assert day["stages"]["asleep"] == 8 * 3600


def test_in_bed_only_and_missing_nights_are_not_sleep_duration(owner):
    interval(owner, stage="in_bed")
    data = sleep.dashboard(owner, DAY, DAY + timedelta(days=1))
    assert data["summary"]["nights"] == 0
    assert all(d["asleep_seconds"] is None for d in data["days"])
    assert data["days"][0]["bedtime"] is not None
    assert data["days"][1]["bedtime"] is None


def test_prefers_v2_session_and_its_stages_but_keeps_nonoverlapping_nap(owner):
    old = session(owner, "sleep_session_v1", 7 * 3600)
    new = session(owner, "sleep_session_v2", 6 * 3600)
    nap = session(owner, "sleep_session_v2", 30 * 60, start="2026-01-10T10:00:00-05:00", end="2026-01-10T10:30:00-05:00")
    interval(owner, stage="light", session=old)
    interval(owner, stage="deep", session=new)
    interval(owner, start="2026-01-10T10:00:00-05:00", end="2026-01-10T10:30:00-05:00", stage="asleep", session=nap)
    data = sleep.dashboard(owner, DAY, DAY, detail=True)
    day = data["days"][0]
    assert day["asleep_seconds"] == 6.5 * 3600
    assert day["session_count"] == 2
    assert day["duration_basis"] == "reported"
    assert day["stages"]["light"] == 0
    assert day["stages"]["deep"] == 8 * 3600
    assert SleepSession.objects.count() == 3  # originals retained


def test_source_selection_and_account_isolation(owner):
    interval(owner, source="A")
    interval(owner, source="B", stage="deep")
    other = User.objects.create_user(username="other-sleep")
    interval(other, source="Private")
    client = APIClient()
    assert client.get("/quantified-self/sleep/summary/").status_code in (401, 403)
    client.force_authenticate(owner)
    response = client.get("/quantified-self/sleep/summary/", {"start": DAY, "end": DAY, "source": source_for(owner, "A").pk})
    assert response.status_code == 200
    data = response.json()
    assert data["days"][0]["asleep_seconds"] == 8 * 3600
    assert {s["name"] for s in data["sources"]} == {"A", "B"}
    assert data["days"][0]["stages"]["deep"] == 0
    assert "intervals" not in data["days"][0]
    assert client.get("/quantified-self/sleep/night/", {"date": DAY, "source": source_for(other, "Private").pk}).status_code == 400


def test_excluded_sessions_intervals_and_presses_stay_out(owner):
    excluded = session(owner, "sleep_session_v2", 3600, excluded=True)
    interval(owner, session=excluded)
    interval(owner, excluded=True, stage="deep")
    save_record(owner, "awakenings", {"timestamp": "2026-01-10T02:00:00-05:00", "source": "Switch"})
    save_record(owner, "awakenings", {"timestamp": "2026-01-10T03:00:00-05:00", "excluded": True})
    data = sleep.dashboard(owner, DAY, DAY, detail=True)
    assert data["days"][0]["asleep_seconds"] is None
    assert data["days"][0]["recorded_awakenings"] == 1
    assert len(data["events"]) == 1 and data["events"][0]["source"] == "Switch"


def test_seven_day_trend_looks_before_range_and_skips_missing(owner):
    interval(owner)
    interval(owner, start="2026-01-11T23:00:00-05:00", end="2026-01-12T05:00:00-05:00")
    data = sleep.dashboard(owner, date(2026, 1, 12), date(2026, 1, 17))
    assert data["days"][0]["trend_seconds"] == 7 * 3600
    assert data["days"][-1]["trend_seconds"] == 6 * 3600
    assert data["summary"]["mean_seconds"] == 6 * 3600


def test_dst_uses_elapsed_time_and_morning_dates(owner):
    interval(owner, start="2025-11-02T00:00:00-04:00", end="2025-11-02T03:00:00-05:00")
    data = sleep.dashboard(owner, date(2025, 11, 2), date(2025, 11, 2))
    assert data["days"][0]["asleep_seconds"] == 4 * 3600
    assert sleep.morning_date(datetime.fromisoformat("2025-12-31T23:00:00-05:00")) == date(2026, 1, 1)


def apple_sleep(stage="AsleepCore", start="2026-01-09 23:00:00 -0500", end="2026-01-10 07:00:00 -0500"):
    return {"type": "HKCategoryTypeIdentifierSleepAnalysis", "sourceName": "Watch", "value": f"HKCategoryValueSleepAnalysis{stage}", "startDate": start, "endDate": end}


def test_apple_sleep_import_is_atomic_repeat_safe_and_keeps_exclusions(owner):
    readings = [record(), apple_sleep(), apple_sleep(), apple_sleep("InBed")]
    preview = apple_health.preview(owner, export(readings))
    summary = next(s for s in preview["summary"] if s["kind"] == "sleep")
    assert summary["total"] == 2 and summary["first_date"] == "2026-01-10"
    assert apple_health.commit(owner, ImportBatch.objects.get(uuid=preview["uuid"]))["imported"] == 3
    row = SleepInterval.objects.get(stage="light")
    row.excluded = True
    row.save()
    second = apple_health.preview(owner, export([*readings, apple_sleep("AsleepREM", end="2026-01-10 08:00:00 -0500")]))
    result = apple_health.commit(owner, ImportBatch.objects.get(uuid=second["uuid"]))
    assert result["imported"] == 1 and result["skipped"] == 3
    row.refresh_from_db()
    assert row.excluded
    assert SleepInterval.objects.count() == 3


@pytest.mark.parametrize("values", [
    {"stage": "unknown"}, {"end": "2026-01-09T22:00:00-05:00"},
    {"end": "2026-01-12T07:00:00-05:00"}, {"start": "2026-01-09T23:00:00"},
])
def test_invalid_sleep_intervals(values):
    with pytest.raises(ValidationError):
        sleep.normalize_interval({"start": "2026-01-09T23:00:00-05:00", "end": "2026-01-10T07:00:00-05:00", "stage": "light", **values})
