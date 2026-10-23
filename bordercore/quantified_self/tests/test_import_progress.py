"""Progress is advisory, account-scoped, and independent of atomic import writes."""
from uuid import uuid4

import pytest
from quantified_self import apple_health, import_progress
from quantified_self.models import BloodPressureReading, ImportBatch, WeightReading
from quantified_self.tests.test_apple_health import export, pressure, record, zipped
from rest_framework.test import APIClient

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="progress-owner")


@pytest.fixture
def progress_cache():
    with override_settings(CACHES={"default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "qs-progress-tests",
    }}):
        cache.clear()
        yield
        cache.clear()


def upload(client, records, progress_id):
    return client.post("/quantified-self/apple-health/import/", {
        "file": SimpleUploadedFile("health.zip", export(records).getvalue(), "application/zip"),
        "progress_id": str(progress_id),
    }, format="multipart")


def test_large_xml_reports_bytes_and_counts_before_finishing(monkeypatch):
    events = []
    ticks = iter(range(100))
    monkeypatch.setattr(apple_health, "monotonic", lambda: next(ticks))
    xml = b'<HealthData><Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scale" value="180" unit="lb" startDate="2025-01-10 08:00:00 -0500"/>'
    xml += b'<Record type="HKQuantityTypeIdentifierStepCount" value="1"/>' * 50000
    xml += b'</HealthData>'
    rows, _ = apple_health.parse_zip(zipped(xml), lambda stage, **values: events.append({"stage": stage, **values}))
    scanning = [event for event in events if event["stage"] == "scanning"]
    assert len(scanning) >= 2
    assert scanning[0]["loaded"] < scanning[0]["total"]
    assert scanning[-1]["loaded"] == scanning[-1]["total"] == len(xml)
    assert all(event["weight"] == 1 and event["blood_pressure"] == 0 for event in scanning)
    assert events[-1]["stage"] == "pairing"
    assert len(rows) == 1


def test_status_endpoint_is_authenticated_and_scoped(owner, progress_cache):
    identifier = uuid4()
    client = APIClient()
    url = f"/quantified-self/imports/progress/{identifier}/"
    assert client.get(url).status_code in (401, 403)
    client.force_authenticate(owner)
    with import_progress.tracking(owner, identifier) as report:
        report("scanning", loaded=50, total=100, weight=42, blood_pressure=10)
        response = client.get(url)
        assert response.json()["weight"] == 42
        assert response["Cache-Control"] == "no-store"
        other = User.objects.create_user(username="progress-other")
        client.force_authenticate(other)
        assert client.get(url).json() == {"stage": "waiting"}
    assert import_progress.get_progress(owner, identifier) == {"stage": "complete"}


def test_upload_and_commit_publish_completion_and_preserve_idempotency(owner, progress_cache):
    client = APIClient()
    client.force_authenticate(owner)
    preview_id, commit_id = uuid4(), uuid4()
    response = upload(client, [record(), *pressure()], preview_id)
    assert response.status_code == 200
    assert import_progress.get_progress(owner, preview_id)["stage"] == "complete"
    assert not WeightReading.objects.exists()
    url = f'/quantified-self/imports/{response.json()["uuid"]}/commit/'
    for identifier in (commit_id, uuid4()):
        response = client.post(url, {"progress_id": str(identifier)}, format="json")
        assert response.json()["imported"] == 2
        assert import_progress.get_progress(owner, identifier)["stage"] == "complete"
    assert WeightReading.objects.count() == BloodPressureReading.objects.count() == 1


def test_invalid_upload_reports_error_without_creating_readings(owner, progress_cache):
    client = APIClient()
    client.force_authenticate(owner)
    identifier = uuid4()
    response = upload(client, [record(), record(value="invalid")], identifier)
    assert response.status_code == 400
    assert import_progress.get_progress(owner, identifier)["stage"] == "error"
    assert not ImportBatch.objects.exists()
    assert not WeightReading.objects.exists()
    assert upload(client, [record()], "not-a-uuid").status_code == 400


def test_save_progress_is_batched_and_counts_actual_writes(owner):
    readings = [record(stamp=f"2025-01-10 {hour:02}:{minute:02}:00 -0500")
                for hour in range(10) for minute in range(60)]
    preview = apple_health.preview(owner, export(readings + pressure()))
    batch = ImportBatch.objects.get(uuid=preview["uuid"])
    events = []
    result = apple_health.commit(owner, batch, lambda stage, **values: events.append({"stage": stage, **values}))
    assert result["imported"] == 601
    saving = [event for event in events if event["stage"] == "saving"]
    assert [event["processed"] for event in saving] == [0, 1, 501]
    assert {event["kind"] for event in saving} == {"weight", "blood-pressure"}
    assert all(event["total"] == 601 for event in saving)
    assert events[-1] == {"stage": "finalizing", "processed": 601, "total": 601, "skipped": 0}


def test_cache_failure_does_not_abort_import(owner, monkeypatch):
    def unavailable(*args, **kwargs):
        raise OSError("cache unavailable")
    monkeypatch.setattr(import_progress.cache, "set", unavailable)
    monkeypatch.setattr(import_progress.cache, "get", unavailable)
    with import_progress.tracking(owner, uuid4()) as report:
        preview = apple_health.preview(owner, export([record()]), report)
        result = apple_health.commit(owner, ImportBatch.objects.get(uuid=preview["uuid"]), report)
    assert result["imported"] == 1
    assert import_progress.get_progress(owner, uuid4()) == {"stage": "unavailable"}
