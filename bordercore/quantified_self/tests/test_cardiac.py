"""Cardiac measurements retain provenance and use daily means for trends."""
from datetime import date
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from django.contrib.auth.models import User

from quantified_self import analytics, apple_health, imports
from quantified_self.models import ImportBatch
from quantified_self.services import KINDS, normalize, save_record, serialize
from .test_apple_health import export, record, pressure


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="cardiac-owner")


@pytest.mark.parametrize("kind,unit", [("resting-heart-rate", "bpm"), ("hrv", "ms")])
def test_record_api_ownership_edit_exclude_export(owner, kind, unit):
    client = APIClient()
    client.force_authenticate(owner)
    url = f"/quantified-self/{kind}/records/"
    data = {"date": "2026-01-10", "value": "58.123456", "unit": unit}
    response = client.post(url, data, format="json")
    assert response.status_code == 201
    row = response.json()
    assert row["unit"] == unit and row["value"] == "58.123456" and row["time"] == ""
    detail = f'{url}{row["uuid"]}/'
    assert client.put(detail, {**data, "value": "60.5"}, format="json").status_code == 200
    assert client.patch(detail, {"excluded": True}, format="json").status_code == 200
    assert client.get(url, {"start": "2026-01-10", "end": "2026-01-10"}).json()["results"][0]["excluded"]
    csv = client.get(f"/quantified-self/{kind}/export/?start=2026-01-10&end=2026-01-10").content
    preview = imports.preview(owner, kind, "CSV copy", csv)
    assert preview["rows"][0]["data"]["unit"] == unit
    client.force_authenticate(User.objects.create_user(username=f"other-{kind}"))
    assert client.patch(detail, {"excluded": False}, format="json").status_code == 404
    assert client.get(url, {"start": "2026-01-10", "end": "2026-01-10"}).json()["count"] == 0


@pytest.mark.parametrize("kind", ["resting-heart-rate", "hrv"])
@pytest.mark.parametrize("value", ["NaN", "Infinity", "0", "-1", "1000000", "1.0000001", "bad"])
def test_invalid_values(kind, value):
    with pytest.raises(ValidationError):
        normalize(kind, {"date": "2026-01-10", "value": value})


@pytest.mark.parametrize("kind", ["resting-heart-rate", "hrv"])
def test_wrong_units(kind):
    with pytest.raises(ValidationError, match="Unit must"):
        normalize(kind, {"date": "2026-01-10", "value": "60", "unit": "lb"})


@pytest.mark.parametrize("kind,key,unit", [("resting-heart-rate", "resting_heart_rate", "bpm"), ("hrv", "hrv", "ms")])
def test_summary_excludes_glitches_and_weights_days_equally(owner, kind, key, unit):
    def add(day, value, **extra):
        return save_record(owner, kind, {"date": day, "value": value, "unit": unit, **extra})[0]
    add("2026-01-01", "40")
    add("2026-01-01", "60")
    add("2026-01-05", "80")
    add("2026-01-05", "900", excluded=True)
    other = User.objects.create_user(username="other-summary")
    save_record(other, kind, {"date": "2026-01-05", "value": "500"})
    summary = analytics.dashboard(owner, date(2026, 1, 1), date(2026, 1, 8), "lb")
    assert summary["days"][0][key] == 50
    assert summary["days"][1][key] is None
    assert summary["days"][6][f"{key}_trend"] == 65
    assert summary["days"][7][f"{key}_trend"] == 80
    assert len(summary["days"][0][f"{key}_samples"]) == 2
    assert summary["summary"][f"{key}_days"] == 2
    assert summary["summary"][f"{key}_readings"] == 3
    assert summary["summary"][f"mean_{key}"] == 65
    assert Decimal(summary["summary"][f"latest_{key}"]["value"]) == 80
    narrow = analytics.dashboard(owner, date(2026, 1, 5), date(2026, 1, 5), "lb")
    assert narrow["days"][0][f"{key}_trend"] == 65  # lookback before range
    assert narrow["summary"][f"{key}_readings"] == 1


def test_apple_import_new_metrics_from_previously_imported_export(owner):
    old = [record(), *pressure()]
    first = apple_health.preview(owner, export(old))
    apple_health.commit(owner, ImportBatch.objects.get(uuid=first["uuid"]))
    rhr = record("RestingHeartRate", "58.25", "count/min", source="Watch")
    hrv = record("HeartRateVariabilitySDNN", "43.123456789", "ms", source="Watch")
    records = [*old, rhr, hrv, hrv, record("HeartRate", "bad", "count/min")]
    progress = []
    preview = apple_health.preview(owner, export(records), lambda stage, **values: progress.append((stage, values)))
    counts = {s["kind"]: s for s in preview["summary"]}
    assert counts["weight"]["existing"] == counts["blood-pressure"]["existing"] == 1
    assert counts["resting-heart-rate"]["new"] == counts["hrv"]["new"] == 1
    assert next(values for stage, values in progress if stage == "scanning")["weight"] == 1
    assert next(values for stage, values in progress if stage == "scanning")["hrv"] == 1
    batch = ImportBatch.objects.get(uuid=preview["uuid"])
    result = apple_health.commit(owner, batch)
    assert (result["imported"], result["skipped"]) == (2, 2)
    hrv_row = KINDS["hrv"].objects.get()
    assert hrv_row.value == Decimal("43.123457")
    assert serialize("hrv", hrv_row)["unit"] == "ms"
    save_record(owner, "hrv", {"date": "2025-01-10", "value": "44", "excluded": True}, instance=hrv_row)
    overlap = apple_health.preview(owner, export([*records, record("RestingHeartRate", "59", "count/min", stamp="2025-01-11 08:00:00 -0400")]))
    result = apple_health.commit(owner, ImportBatch.objects.get(uuid=overlap["uuid"]))
    assert (result["imported"], result["skipped"]) == (1, 4)
    hrv_row.refresh_from_db()
    assert hrv_row.value == 44 and hrv_row.excluded


@pytest.mark.parametrize("apple_type,unit", [("RestingHeartRate", "ms"), ("HeartRateVariabilitySDNN", "count/min")])
def test_apple_wrong_units_rejected(apple_type, unit):
    with pytest.raises(ValidationError, match="units must"):
        apple_health.parse_zip(export([record(apple_type, "50", unit)]))
