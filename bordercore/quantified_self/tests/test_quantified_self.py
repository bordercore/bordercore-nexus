"""Behavioral coverage for measurements, night boundaries, imports and ownership."""
import json
from datetime import date, datetime
from datetime import timezone as dt_timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from quantified_self import analytics, imports
from quantified_self.models import AwakeningEvent, DataSource, SleepNight, WeightReading
from quantified_self.services import normalize, save_record, serialize
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner():
    return User.objects.create_user(username="qs-owner", password="test-password")


@pytest.fixture
def client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


def weight(**kwargs):
    return {"date": "2026-01-10", "value": "180", "unit": "lb", **kwargs}


def awakening(**kwargs):
    return {"timestamp": "2026-01-10T02:15:00-05:00", "external_id": "press-1", "source": "Wumpus", **kwargs}


def test_unknown_time_and_original_units(owner):
    row, _ = save_record(owner, "weight", weight())
    assert row.occurred_at is None and row.time is None
    assert row.value == Decimal("180")
    assert row.kilograms == Decimal("81.646627")
    assert serialize("weight", row)["time"] == ""


@pytest.mark.parametrize("data", [weight(value="NaN"), weight(value="Infinity"), weight(value="0"), weight(value="-2"), weight(value="1.1234"), weight(unit="stone"), weight(time="12:00", timezone="invalid")])
def test_invalid_measurements(data):
    with pytest.raises(ValidationError):
        normalize("weight", data)


def test_blood_pressure_validation():
    values = normalize("blood-pressure", {"date": "2026-01-10", "systolic": "120", "diastolic": "80", "pulse": ""})
    assert values["pulse"] is None
    with pytest.raises(ValidationError):
        normalize("blood-pressure", {"date":"2026-01-10", "systolic":"80", "diastolic":"120"})


@pytest.mark.parametrize("stamp, expected", [("2026-01-09T23:50:00-05:00", "2026-01-10"), ("2026-01-10T00:10:00-05:00", "2026-01-10"), ("2026-01-10T11:59:59-05:00", "2026-01-10"), ("2026-01-10T12:00:00-05:00", "2026-01-11")])
def test_night_boundaries(owner, stamp, expected):
    event, _ = save_record(owner, "awakenings", awakening(timestamp=stamp))
    assert str(event.night.date) == expected


def test_dst_ambiguous_and_nonexistent_local_times():
    with pytest.raises(ValidationError, match="occurs twice"):
        normalize("weight", weight(date="2025-11-02", time="01:30"))
    early = normalize("weight", weight(date="2025-11-02", time="01:30", utc_offset="-04:00"))
    late = normalize("weight", weight(date="2025-11-02", time="01:30", utc_offset="-05:00"))
    assert (late["occurred_at"] - early["occurred_at"]).seconds == 3600
    with pytest.raises(ValidationError, match="does not exist"):
        normalize("weight", weight(date="2026-03-08", time="02:30"))


def test_awakening_retry_preserves_correction_and_exclusion(owner):
    row, created = save_record(owner, "awakenings", awakening())
    assert created
    save_record(owner, "awakenings", awakening(timestamp="2026-01-10T03:15:00-05:00", excluded=True), instance=row)
    replay, created = save_record(owner, "awakenings", awakening())
    assert not created and replay.excluded
    assert replay.occurred_at.hour == 8
    assert AwakeningEvent.objects.count() == 1


def test_late_event_reopens_night_and_old_review_conflicts(owner, client):
    row, _ = save_record(owner, "awakenings", awakening())
    night = row.night
    revision = night.modified_at.isoformat()
    payload = {"nights": [{"date": str(night.date), "revision": revision, "status": "complete"}]}
    assert client.post("/quantified-self/nights/review/", payload, format="json").status_code == 200
    save_record(owner, "awakenings", awakening(external_id="press-2"))
    night.refresh_from_db()
    assert night.status == "unreviewed"
    assert client.post("/quantified-self/nights/review/", payload, format="json").status_code == 409


def test_bulk_review_conflict_is_atomic(owner, client):
    SleepNight.objects.create(user=owner, date="2026-01-11")
    response = client.post("/quantified-self/nights/review/", {"nights": [
        {"date": "2026-01-10", "revision": None, "status": "complete"},
        {"date": "2026-01-11", "revision": None, "status": "complete"}]}, format="json")
    assert response.status_code == 409
    assert not SleepNight.objects.filter(date="2026-01-10").exists()


def test_move_event_reopens_both_nights(owner):
    event, _ = save_record(owner, "awakenings", awakening())
    old = event.night
    old.status = "complete"
    old.save()
    moved, _ = save_record(owner, "awakenings", awakening(timestamp="2026-01-11T03:00:00-05:00"), instance=event)
    old.refresh_from_db()
    assert old.status == moved.night.status == "unreviewed"


def test_missing_and_zero_and_daily_weighted_trend(owner):
    SleepNight.objects.create(user=owner, date="2026-01-10", status="complete")
    save_record(owner, "weight", weight(date="2026-01-09", value="100", unit="kg"))
    save_record(owner, "weight", weight(value="110", unit="kg"))
    save_record(owner, "weight", weight(value="130", unit="kg"))
    data = analytics.dashboard(owner, date(2026,1,10), date(2026,1,11), "kg")
    assert data["days"][0]["awakenings"] == 0
    assert data["days"][1]["awakenings"] is None
    assert data["days"][0]["weight_trend"] == 110
    assert data["summary"]["mean_awakenings"] == 0
    assert data["summary"]["completed_nights"] == 1


def test_repeated_pressure_readings_remain_separate(owner):
    for systolic in (120, 130):
        save_record(owner,"blood-pressure",{"date":"2026-01-10","time":"08:00","systolic":systolic,"diastolic":80})
    data = analytics.dashboard(owner,date(2026,1,10),date(2026,1,10),"lb")
    assert len(data["days"][0]["pressure_samples"]) == 2
    assert data["days"][0]["systolic"] == 125


def test_ownership(client):
    other = User.objects.create_user(username="qs-other")
    row, _ = save_record(other, "weight", weight())
    result = client.get("/quantified-self/weight/records/?start=2026-01-01&end=2026-01-31")
    assert result.json()["count"] == 0
    assert client.put(f"/quantified-self/weight/records/{row.uuid}/", weight(value="190"), format="json").status_code == 404
    assert "180" not in client.get("/quantified-self/weight/export/?start=2026-01-01&end=2026-01-31").content.decode()


def test_unauthenticated_blocked():
    client = APIClient()
    assert client.get("/quantified-self/summary/").status_code in (401,403)
    assert client.post("/quantified-self/weight/records/", weight()).status_code in (401,403)
    assert client.get("/quantified-self/").status_code == 302


def test_preview_commit_retry_and_edited_reading(owner):
    content = b"date,value,unit,external_id\n2026-01-10,180,lb,scale-1\n"
    result = imports.preview(owner,"weight","Scale",content)
    assert WeightReading.objects.count() == 0
    from quantified_self.models import ImportBatch
    batch = ImportBatch.objects.get(uuid=result["uuid"])
    assert imports.commit(owner,batch,[]) == {"imported":1,"skipped":0}
    row = WeightReading.objects.get()
    save_record(owner,"weight",weight(value="181"),instance=row)
    assert imports.commit(owner,batch,[]) == {"imported":1,"skipped":0}
    assert imports.preview(owner,"weight","Scale",content)["committed"]
    second = imports.preview(owner,"weight","Scale",content+b"2026-01-11,179,lb,scale-2\n")
    assert imports.commit(owner,ImportBatch.objects.get(uuid=second["uuid"]),[]) == {"imported":1,"skipped":1}
    row.refresh_from_db()
    assert row.value == 181


def test_import_errors_write_no_readings(owner):
    result = imports.preview(owner,"weight","Scale",b"date,value,unit\n2026-01-10,180,lb\n2026-01-11,nope,lb\n")
    from quantified_self.models import ImportBatch
    with pytest.raises(ValidationError):
        imports.commit(owner,ImportBatch.objects.get(uuid=result["uuid"]),[])
    assert WeightReading.objects.count() == 0


def test_overlapping_imports_flag_candidates(owner):
    save_record(owner,"weight",weight())
    preview = imports.preview(owner,"weight","CSV",b"date,value,unit\n2026-01-10,180,lb\n")
    assert preview["rows"][0]["status"] == "possible_duplicate"
    from quantified_self.models import ImportBatch
    assert imports.commit(owner,ImportBatch.objects.get(uuid=preview["uuid"]),[]) == {"imported":0,"skipped":1}


def test_export_roundtrip_timezone_and_source(owner, client):
    row, _ = save_record(owner,"weight",weight(time="08:30",source="Scale",external_id="scale-1",note="morning, before breakfast"))
    csv = client.get("/quantified-self/weight/export/?start=2026-01-01&end=2026-01-31").content
    result = imports.preview(owner,"weight","Export",csv)
    assert result["rows"][0]["status"] == "existing_id"
    assert result["rows"][0]["data"]["source"] == "Scale"
    assert result["rows"][0]["data"]["time"] == "08:30:00"


def test_csv_endpoint_and_cross_user_batch(owner, client):
    upload = SimpleUploadedFile("weight.csv",b"date,value,unit\n2026-01-10,180,lb\n",content_type="text/csv")
    response = client.post("/quantified-self/weight/import/",{"file":upload,"source":"CSV"},format="multipart")
    assert response.status_code == 200
    uuid = response.json()["uuid"]
    other = User.objects.create_user(username="other-batch-user")
    client.force_authenticate(other)
    assert client.post(f"/quantified-self/imports/{uuid}/commit/",{},format="json").status_code == 404


def test_http_date_validation(client):
    for query in ("start=bad", "start=2026-01-20&end=2026-01-01", "unit=stone"):
        assert client.get(f"/quantified-self/summary/?{query}").status_code == 400


def test_automatic_ingestion_requires_identity_and_supports_token_auth(owner):
    from rest_framework.authtoken.models import Token
    token = Token.objects.create(user=owner)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    url = "/api/quantified-self/awakenings/"
    missing = awakening()
    missing.pop("external_id")
    assert client.post(url, missing, format="json").status_code == 400
    first = client.post(url, awakening(), format="json")
    replay = client.post(url, awakening(), format="json")
    assert first.status_code == 201 and replay.status_code == 200
    assert first.json()["uuid"] == replay.json()["uuid"]


@pytest.mark.parametrize("stamp, accepted", [
    ("2026-01-09T21:59:59.999999-05:00", False),
    ("2026-01-09T22:00:00-05:00", True),
    ("2026-01-10T00:00:00-05:00", True),
    ("2026-01-10T08:59:59.999999-05:00", True),
    ("2026-01-10T09:00:00-05:00", False),
    ("2026-01-10T12:00:00-05:00", False),
    ("2026-01-10T02:00:00Z", False),  # 21:00 the previous day in New York
    ("2026-01-10T03:00:00Z", True),
    ("2026-07-10T02:00:00Z", True),  # 22:00 with daylight saving
    ("2026-07-10T13:00:00Z", False),
    ("2025-11-02T01:30:00-04:00", True),
    ("2025-11-02T01:30:00-05:00", True),
])
def test_switch_window_and_logging(client, caplog, stamp, accepted):
    caplog.set_level("INFO", logger="bordercore.quantified_self.views")
    response = client.post("/api/quantified-self/awakenings/", awakening(timestamp=stamp), format="json")
    assert response.status_code == (201 if accepted else 200)
    assert AwakeningEvent.objects.count() == int(accepted)
    assert SleepNight.objects.count() == int(accepted)
    assert DataSource.objects.count() == int(accepted)
    events = [json.loads(record.getMessage().split(": ", 1)[1]) for record in caplog.records
              if record.name == "bordercore.quantified_self.views"]
    assert [event["status"] for event in events] == ["received", "recorded" if accepted else "ignored"]
    assert all(event["external_id"] == "press-1" and event["source"] == "Wumpus" for event in events)
    assert events[-1]["timezone"] == "America/New_York"
    if not accepted:
        assert response.json() == {"status": "ignored", "reason": "outside_sleep_window"}


def test_daytime_switch_retry_does_not_reopen_reviewed_night(owner, client, caplog):
    caplog.set_level("INFO", logger="bordercore.quantified_self.views")
    night = SleepNight.objects.create(user=owner, date="2026-01-10", status="complete")
    for _ in range(2):
        response = client.post("/api/quantified-self/awakenings/",
                               awakening(timestamp="2026-01-10T10:00:00-05:00"), format="json")
        assert response.json()["status"] == "ignored"
    night.refresh_from_db()
    assert night.status == "complete"
    assert not AwakeningEvent.objects.exists()
    assert sum('"status": "received"' in record.getMessage() for record in caplog.records) == 2
    assert sum('"status": "ignored"' in record.getMessage() for record in caplog.records) == 2


def test_nighttime_switch_retry_is_logged_without_duplicate(owner, client, caplog):
    caplog.set_level("INFO", logger="bordercore.quantified_self.views")
    for _ in range(2):
        client.post("/api/quantified-self/awakenings/", awakening(), format="json")
    assert AwakeningEvent.objects.count() == 1
    assert any('"status": "duplicate"' in record.getMessage() for record in caplog.records)


def test_switch_uses_press_time_not_delivery_time(client, monkeypatch):
    monkeypatch.setattr("quantified_self.services.timezone.now",
                        lambda: datetime(2026, 1, 10, 17, tzinfo=dt_timezone.utc))
    response = client.post("/api/quantified-self/awakenings/", awakening(), format="json")
    assert response.status_code == 201  # overnight press delivered at noon
    assert AwakeningEvent.objects.get().occurred_at.hour == 7


def test_daytime_manual_capture_and_invalid_switch_timestamp(client):
    data = awakening(timestamp="2026-01-10T12:00:00-05:00")
    assert client.post("/quantified-self/awakenings/records/", data, format="json").status_code == 201
    for stamp in ("invalid", "2026-01-10T12:00:00", "2099-01-10T12:00:00-05:00"):
        response = client.post("/api/quantified-self/awakenings/", awakening(timestamp=stamp), format="json")
        assert response.status_code == 400
    assert AwakeningEvent.objects.count() == 1


def test_switch_receipt_is_logged_even_if_database_write_fails(client, monkeypatch, caplog):
    caplog.set_level("INFO", logger="bordercore.quantified_self.views")
    def failed_write(*args, **kwargs):
        raise RuntimeError("database unavailable")
    monkeypatch.setattr("quantified_self.views.save_record", failed_write)
    with pytest.raises(RuntimeError, match="database unavailable"):
        client.post("/api/quantified-self/awakenings/", awakening(), format="json")
    assert any('"status": "received"' in record.getMessage() for record in caplog.records)
    assert not AwakeningEvent.objects.exists()


def test_formula_safe_csv_roundtrip(owner):
    content = imports.csv_text("weight", [{**weight(), "source": "=formula", "note": "'literal", "external_id": "@event"}]).encode()
    assert b"'=formula" in content
    result = imports.preview(owner,"weight","CSV",content)
    assert result["rows"][0]["data"]["note"] == "'literal"
    assert result["rows"][0]["data"]["source"] == "=formula"
    assert result["rows"][0]["data"]["external_id"] == "@event"


def test_two_equal_readings_can_be_explicitly_imported(owner):
    result = imports.preview(owner,"weight","Scale",b"date,value,unit\n2026-01-10,180,lb\n2026-01-10,180,lb\n")
    assert result["rows"][1]["status"] == "possible_duplicate"
    from quantified_self.models import ImportBatch
    assert imports.commit(owner,ImportBatch.objects.get(uuid=result["uuid"]),[3]) == {"imported":2,"skipped":0}


def test_exclusion_removes_event_from_analysis_but_not_history(owner, client):
    row, _ = save_record(owner,"awakenings",awakening(excluded=True))
    data = analytics.dashboard(owner,date(2026,1,10),date(2026,1,10),"lb")
    assert data["summary"]["recorded_awakenings"] == 0
    response = client.get("/quantified-self/awakenings/records/?start=2026-01-01&end=2026-01-31")
    assert response.json()["count"] == 1
    assert response.json()["results"][0]["excluded"]


def test_session_write_requires_csrf(owner):
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(owner)
    response = client.post("/quantified-self/weight/records/",weight(),format="json")
    assert response.status_code == 403


def test_clock_fallback_events_remain_distinct(owner):
    first,_ = save_record(owner,"awakenings",awakening(timestamp="2025-11-02T01:30:00-04:00",external_id="first"))
    second,_ = save_record(owner,"awakenings",awakening(timestamp="2025-11-02T01:30:00-05:00",external_id="second"))
    assert first.night_id == second.night_id
    assert (second.occurred_at-first.occurred_at).seconds == 3600
    assert serialize("awakenings",first)["timestamp"] != serialize("awakenings",second)["timestamp"]


@pytest.mark.django_db(transaction=True)
def test_simultaneous_delivery_creates_one_event(owner):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from django.db import connections
    barrier = Barrier(2)
    def deliver():
        try:
            user = User.objects.get(pk=owner.pk)
            barrier.wait(timeout=5)
            row, created = save_record(user,"awakenings",awakening())
            return str(row.uuid), created
        finally:
            connections.close_all()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: deliver(),range(2)))
    assert results[0][0] == results[1][0]
    assert sorted(created for _,created in results) == [False,True]
    assert AwakeningEvent.objects.filter(user=owner).count() == 1
