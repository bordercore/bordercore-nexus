"""Apple exports repeat nested records; imports must remain safe across exports."""
import io
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
from threading import Barrier
from xml.etree.ElementTree import Element, SubElement, tostring
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from quantified_self import apple_health
from quantified_self.models import BloodPressureReading, ImportBatch, WeightReading
from quantified_self.services import save_record
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connections


def record(kind="BodyMass", value="180", unit="lb", source="Scale", stamp="2025-01-10 08:00:00 -0400", **extra):
    return {"type": f"HKQuantityTypeIdentifier{kind}", "value": value, "unit": unit,
            "sourceName": source, "startDate": stamp, "endDate": stamp, **extra}


def pressure(stamp="2025-01-10 08:00:00 -0400", source="OMRON", systolic="120", diastolic="80"):
    return [record("BloodPressureSystolic", systolic, "mmHg", source, stamp),
            record("BloodPressureDiastolic", diastolic, "mmHg", source, stamp)]


def zipped(xml, name="apple_health_export/export.xml"):
    output = io.BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        archive.writestr(name, xml)
    output.seek(0)
    return output


def export(records, nested=(), metadata=None):
    root = Element("HealthData")
    for attrs in records:
        child = SubElement(root, "Record", attrs)
        for key, value in (metadata or {}).items():
            SubElement(child, "MetadataEntry", key=key, value=value)
    if nested:
        correlation = SubElement(root, "Correlation", type="HKCorrelationTypeIdentifierBloodPressure")
        for attrs in nested:
            SubElement(correlation, "Record", attrs)
    return zipped(tostring(root))


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="apple-owner")


def batch_preview(owner, records, **kwargs):
    result = apple_health.preview(owner, export(records, **kwargs))
    return result, ImportBatch.objects.get(uuid=result["uuid"])


def test_stream_pairs_nested_and_standalone_records_and_preserves_instant():
    # Apple can export a summer offset even for a winter measurement. Preserve
    # the instant, converting the display time to the actual New York offset.
    rows, warnings = apple_health.parse_zip(export([record(), *pressure(), *pressure()], nested=pressure()))
    assert len(rows) == 2
    assert warnings == {"repeated_entries": 4, "incomplete_pressure": 0, "ambiguous_pressure": 0}
    weight = next(row["data"] for row in rows if row["kind"] == "weight")
    assert weight["date"] == "2025-01-10" and weight["time"] == "07:00:00"
    assert weight["utc_offset"] == "-0500"
    assert weight["source"] == "Apple Health · Scale"


def test_metadata_timezone_and_unit_precision():
    rows, _ = apple_health.parse_zip(export([record(value="80123.45", unit="g")], metadata={"HKTimeZone": "Europe/London"}))
    assert rows[0]["data"]["value"] == "80.123"
    assert rows[0]["data"]["unit"] == "kg"
    assert rows[0]["data"]["time"] == "12:00:00"
    assert rows[0]["data"]["timezone"] == "Europe/London"


def test_non_target_data_ignored_and_unsafe_pressure_pairs_reported():
    records = [record(), record("HeartRate", "bad", "count/min"),
               pressure(source="A")[0], pressure(source="B")[1],
               *pressure(), pressure(systolic="121")[0]]
    rows, warnings = apple_health.parse_zip(export(records))
    assert len(rows) == 1
    assert warnings["incomplete_pressure"] == 2
    assert warnings["ambiguous_pressure"] == 1


@pytest.mark.parametrize("content, name", [
    (b"broken", "apple_health_export/export.xml"),
    (b"<NotHealth/>", "apple_health_export/export.xml"),
    (b"<HealthData/>", "export_cda.xml"),
    (b"<HealthData/>", "../../export.xml"),
    (b'<!DOCTYPE HealthData SYSTEM "file:///etc/passwd"><HealthData/>', "export.xml"),
    (b'<!DOCTYPE HealthData [<!ENTITY x SYSTEM "file:///etc/passwd">]><HealthData>&x;</HealthData>', "export.xml"),
])
def test_bad_or_external_xml_is_rejected(content, name):
    with pytest.raises(ValidationError):
        apple_health.parse_zip(zipped(content, name))


def test_non_zip_and_limits(monkeypatch):
    with pytest.raises(ValidationError):
        apple_health.parse_zip(io.BytesIO(b"not zip"))
    monkeypatch.setattr(apple_health, "MAX_XML_BYTES", 10)
    with pytest.raises(ValidationError, match="XML"):
        apple_health.parse_zip(export([record()]))
    monkeypatch.setattr(apple_health, "MAX_ZIP_BYTES", 10)
    with pytest.raises(ValidationError, match="ZIP files"):
        apple_health.parse_zip(export([record()]))


def test_repeat_and_overlapping_exports_preserve_edits(owner):
    first, batch = batch_preview(owner, [record(), *pressure()], nested=pressure())
    assert first["summary"][0]["new"] == 1
    assert WeightReading.objects.count() == BloodPressureReading.objects.count() == 0
    assert apple_health.commit(owner, batch)["imported"] == 2
    weight = WeightReading.objects.get()
    assert weight.occurred_at == datetime(2025, 1, 10, 12, tzinfo=timezone.utc)
    save_record(owner, "weight", {"date": "2025-01-10", "value": "181", "unit": "lb", "excluded": True}, instance=weight)
    # Same measurements with different ordering, duplication, and metadata.
    repeated, same_batch = batch_preview(owner, [*pressure(), record(), record()], metadata={"HKExternalUUID": "new-export-metadata"})
    assert repeated["committed"]
    assert same_batch.pk == batch.pk
    assert apple_health.commit(owner, same_batch)["imported"] == 2  # prior result
    overlapping, second = batch_preview(owner, [record(), *pressure(), record(stamp="2025-01-11 08:00:00 -0400")])
    assert sum(item["new"] for item in overlapping["summary"]) == 1
    result = apple_health.commit(owner, second)
    assert (result["imported"], result["skipped"]) == (1, 2)
    weight.refresh_from_db()
    assert weight.value == Decimal("181") and weight.excluded and weight.time is None
    assert WeightReading.objects.count() == 2
    assert BloodPressureReading.objects.count() == 1


def test_concurrent_previews_recheck_duplicates_on_commit(owner):
    _, first = batch_preview(owner, [record()])
    _, second = batch_preview(owner, [record(), *pressure()])
    apple_health.commit(owner, first)
    result = apple_health.commit(owner, second)
    assert (result["imported"], result["skipped"]) == (1, 1)


def test_distinct_times_sources_and_dst_instants_are_retained(owner):
    records = [record(stamp="2025-11-02 01:30:00 -0400"),
               record(stamp="2025-11-02 01:30:00 -0500"),
               record(source="Other scale", stamp="2025-11-02 01:30:00 -0500")]
    _, batch = batch_preview(owner, records)
    assert apple_health.commit(owner, batch)["imported"] == 3
    assert WeightReading.objects.values("occurred_at").distinct().count() == 2


def test_corrupt_or_invalid_readings_do_not_create_batch(owner):
    with pytest.raises(ValidationError):
        apple_health.preview(owner, export([record(), record(value="NaN")]))
    assert not ImportBatch.objects.exists()
    assert not WeightReading.objects.exists()


def test_commit_rolls_back_both_trackers_on_validation_failure(owner):
    _, batch = batch_preview(owner, [record(), *pressure()])
    batch.rows[-1]["data"]["value"] = "invalid"
    batch.save()
    with pytest.raises(ValidationError):
        apple_health.commit(owner, batch)
    assert not WeightReading.objects.exists()
    assert not BloodPressureReading.objects.exists()
    batch.refresh_from_db()
    assert batch.committed_at is None


def test_endpoint_upload_commit_repeat_and_account_isolation(owner):
    client = APIClient()
    url = "/quantified-self/apple-health/import/"
    assert client.post(url, {}).status_code in (401, 403)
    client.force_authenticate(owner)
    assert client.post(url, {}, format="multipart").status_code == 400
    data = export([record(), *pressure()]).getvalue()
    def upload():
        return client.post(url, {"file": SimpleUploadedFile("health.zip", data, "application/zip")}, format="multipart")
    response = upload()
    assert response.status_code == 200
    commit_url = f'/quantified-self/imports/{response.json()["uuid"]}/commit/'
    assert client.post(commit_url, {}, format="json").json()["imported"] == 2
    assert upload().json()["committed"]
    other = User.objects.create_user(username="apple-other")
    client.force_authenticate(other)
    assert client.post(commit_url, {}, format="json").status_code == 404
    other_preview = upload().json()
    assert all(item["existing"] == 0 for item in other_preview["summary"])
    assert client.post(f'/quantified-self/imports/{other_preview["uuid"]}/commit/', {}, format="json").json()["imported"] == 2
    assert WeightReading.objects.filter(user=other).count() == 1


@pytest.mark.django_db(transaction=True)
def test_simultaneous_overlapping_commits_create_each_reading_once(owner):
    _, first = batch_preview(owner, [record()])
    _, second = batch_preview(owner, [record(), *pressure()])
    barrier = Barrier(2)
    def deliver(batch):
        try:
            barrier.wait(timeout=5)
            return apple_health.commit(User.objects.get(pk=owner.pk), batch)
        finally:
            connections.close_all()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(deliver, [first, second]))
    assert sum(result["imported"] for result in results) == 2
    assert WeightReading.objects.count() == BloodPressureReading.objects.count() == 1
