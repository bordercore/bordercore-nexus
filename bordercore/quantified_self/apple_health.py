"""Stream Apple Health ZIP exports into repeat-safe weight and pressure batches."""
import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone as dt_timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, BinaryIO
from zipfile import BadZipFile, ZipFile
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from zlib import error as ZlibError

from lxml import etree

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from .models import ImportBatch
from .services import KINDS, LB_KG, ZONE, fail, lock_user, normalize, source_for

MAX_ZIP_BYTES = 512 * 1024 * 1024
MAX_XML_BYTES = 4 * 1024 * 1024 * 1024
MAX_READINGS = 20000
TYPES = {
    "HKQuantityTypeIdentifierBodyMass": "weight",
    "HKQuantityTypeIdentifierBloodPressureSystolic": "systolic",
    "HKQuantityTypeIdentifierBloodPressureDiastolic": "diastolic",
}


def fingerprint(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def timestamp(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value)
        if parsed.utcoffset() is None or parsed.microsecond:
            raise ValueError
        return parsed.astimezone(dt_timezone.utc)
    except (ValueError, OverflowError):
        fail("An Apple Health measurement has an invalid timestamp or missing UTC offset.")


def source_name(raw: str) -> str:
    name = f"Apple Health · {raw.strip() or 'Unknown source'}"
    # Preserve distinguishable identities even for unusually long device names.
    return name if len(name) <= 100 else name[:82] + " · " + fingerprint(name)[:15]


class HealthParser:
    """A SAX-style lxml target: unrelated records never accumulate in memory."""

    def __init__(self) -> None:
        self.root_seen = False
        self.current: dict[str, str] | None = None
        self.rows: dict[str, dict[str, Any]] = {}
        self.pressure: dict[tuple[str, str, str], dict[str, Any]] = {}
        self.repeated = 0
        self.selected_records = 0

    def start(self, tag: str, attributes: Any) -> None:
        if not self.root_seen:
            if tag != "HealthData":
                fail("export.xml must contain an Apple Health HealthData document.")
            self.root_seen = True
        if tag == "Record" and attributes.get("type") in TYPES:
            self.current = dict(attributes)
        elif tag == "MetadataEntry" and self.current is not None and attributes.get("key") == "HKTimeZone":
            self.current["timezone"] = attributes.get("value", "")

    def end(self, tag: str) -> None:
        if tag == "Record" and self.current is not None:
            self.record(self.current)
            self.current = None

    def data(self, data: str) -> None:
        pass

    def doctype(self, name: str, public_id: str | None, system_id: str | None) -> None:
        if public_id or system_id:
            fail("External XML document definitions are not supported.")

    def close(self) -> None:
        pass

    def record(self, record: dict[str, str]) -> None:
        self.selected_records += 1
        if self.selected_records > MAX_READINGS * 10:
            fail("This export contains too many weight or blood-pressure entries (limit 200,000).")
        kind = TYPES[record["type"]]
        start = timestamp(record.get("startDate", ""))
        end = timestamp(record.get("endDate", record.get("startDate", "")))
        if end < start:
            fail("An Apple Health measurement ends before it starts.")
        zone_name = record.get("timezone") or ZONE
        try:
            local = start.astimezone(ZoneInfo(zone_name))
        except (ValueError, ZoneInfoNotFoundError):
            zone_name = ZONE
            local = start.astimezone(ZoneInfo(ZONE))
        source = source_name(record.get("sourceName", ""))
        data = {"date": local.date().isoformat(), "time": local.time().isoformat(),
                "timezone": zone_name, "utc_offset": local.strftime("%z"), "source": source}
        try:
            value = Decimal(record.get("value", ""))
            if not value.is_finite() or not 0 < value < 1000000:
                raise ValueError
            if kind == "weight":
                unit = record.get("unit")
                if unit == "g":
                    value /= 1000
                    unit = "kg"
                if unit not in ("kg", "lb"):
                    fail("Apple Health weight units must be kg, lb, or g.")
                data.update(value=str(value.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)), unit=unit)
                kilograms = value * (LB_KG if unit == "lb" else 1)
                identity = ["weight", source, start.isoformat(), str(kilograms.quantize(Decimal("0.000001")))]
                self.add("weight", data, identity)
            else:
                if record.get("unit") != "mmHg" or value != value.to_integral_value():
                    fail("Apple Health blood pressure must be whole numbers in mmHg.")
                key = (source, start.isoformat(), end.isoformat())
                pair = self.pressure.setdefault(key, {"data": data, "systolic": set(), "diastolic": set()})
                if int(value) in pair[kind]:
                    self.repeated += 1
                pair[kind].add(int(value))
                if len(self.pressure) > MAX_READINGS:
                    fail("Import at most 20,000 distinct readings at a time.")
        except (InvalidOperation, ValueError):
            fail("An Apple Health weight or blood-pressure measurement has an invalid value.")

    def add(self, kind: str, data: dict[str, str], identity: list[Any]) -> None:
        external_id = "apple-health-v1:" + fingerprint(identity)
        data["external_id"] = external_id
        normalize(kind, data)
        if external_id in self.rows:
            self.repeated += 1
        else:
            self.rows[external_id] = {"kind": kind, "data": data}
        if len(self.rows) > MAX_READINGS:
            fail("Import at most 20,000 distinct readings at a time.")

    def finish(self) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        incomplete = ambiguous = 0
        for (source, start, _), pair in self.pressure.items():
            if not pair["systolic"] or not pair["diastolic"]:
                incomplete += 1
                continue
            if len(pair["systolic"]) != 1 or len(pair["diastolic"]) != 1:
                ambiguous += 1
                continue
            systolic, diastolic = next(iter(pair["systolic"])), next(iter(pair["diastolic"]))
            data = {**pair["data"], "systolic": str(systolic), "diastolic": str(diastolic)}
            self.add("blood-pressure", data, ["blood-pressure", source, start, systolic, diastolic])
        rows = sorted(self.rows.values(), key=lambda row: (row["kind"], row["data"]["external_id"]))
        if not rows:
            fail("No importable weight or paired blood-pressure readings were found in this export.")
        return rows, {"repeated_entries": self.repeated, "incomplete_pressure": incomplete,
                      "ambiguous_pressure": ambiguous}


def parse_zip(upload: BinaryIO) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Read only export.xml; never extract routes, clinical files, or the full XML."""
    upload.seek(0, 2)
    if upload.tell() > MAX_ZIP_BYTES:
        fail("Apple Health ZIP files must be no larger than 512 MB.")
    upload.seek(0)
    target = HealthParser()
    try:
        with ZipFile(upload) as archive:
            entries = archive.infolist()
            if len(entries) > 10000:
                fail("The ZIP contains too many files (limit 10,000).")
            candidates = [entry for entry in entries if entry.filename in ("export.xml", "apple_health_export/export.xml")]
            if len(candidates) != 1:
                fail("Upload an Apple Health ZIP containing exactly one export.xml.")
            entry = candidates[0]
            if entry.file_size > MAX_XML_BYTES:
                fail("The Apple Health XML must be no larger than 4 GB.")
            parser = etree.XMLParser(target=target, resolve_entities=False, no_network=True, load_dtd=False)
            with archive.open(entry) as stream:
                size = 0
                while chunk := stream.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_XML_BYTES:
                        fail("The Apple Health XML must be no larger than 4 GB.")
                    parser.feed(chunk)
                parser.close()
    except (BadZipFile, etree.XMLSyntaxError, RuntimeError, NotImplementedError, EOFError, ZlibError):
        fail("Unable to read this Apple Health ZIP. Upload an intact, unencrypted export.")
    return target.finish()


def classified_rows(user: User, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    existing: dict[str, set[tuple[str, str | None]]] = {}
    for kind in ("weight", "blood-pressure"):
        sources = {row["data"]["source"] for row in rows if row["kind"] == kind}
        existing[kind] = set(KINDS[kind].objects.filter(user=user, source__name__in=sources)
                             .values_list("source__name", "external_id"))
    return [{**row, "status": "existing_id" if (row["data"]["source"], row["data"]["external_id"]) in existing[row["kind"]] else "new"}
            for row in rows]


def summary(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for kind in ("weight", "blood-pressure"):
        readings = [row for row in rows if row["kind"] == kind]
        dates = [row["data"]["date"] for row in readings]
        result.append({"kind": kind, "total": len(readings), "new": sum(row["status"] == "new" for row in readings),
                       "existing": sum(row["status"] == "existing_id" for row in readings),
                       "first_date": min(dates) if dates else None, "last_date": max(dates) if dates else None,
                       "sources": sorted({row["data"]["source"] for row in readings})})
    return result


def preview(user: User, upload: BinaryIO) -> dict[str, Any]:
    rows, warnings = parse_zip(upload)
    # No database lock is held while processing a potentially multi-GB XML file.
    with transaction.atomic():
        lock_user(user)
        batch, _ = ImportBatch.objects.get_or_create(user=user, source=source_for(user, "Apple Health"),
            kind="apple-health", digest=fingerprint(rows), defaults={"rows": rows, "result": {"warnings": warnings}})
        classified = classified_rows(user, rows)
        return {"uuid": str(batch.uuid), "committed": batch.committed_at is not None, "result": batch.result,
                "summary": summary(classified), "warnings": warnings, "rows": sorted(classified, key=lambda r: (r["data"]["date"], r["data"]["time"]), reverse=True)[:50]}


@transaction.atomic
def commit(user: User, batch: ImportBatch) -> dict[str, Any]:
    lock_user(user)
    batch.refresh_from_db()
    if batch.committed_at:
        return batch.result
    rows = classified_rows(user, batch.rows)
    sources = {name: source_for(user, name) for name in {row["data"]["source"] for row in rows}}
    pending: dict[str, list[Any]] = defaultdict(list)
    for row in rows:
        if row["status"] == "new":
            pending[row["kind"]].append(KINDS[row["kind"]](user=user, source=sources[row["data"]["source"]],
                import_batch=batch, **normalize(row["kind"], row["data"])))
    for kind, records in pending.items():
        KINDS[kind].objects.bulk_create(records, batch_size=500)
    imported = sum(len(records) for records in pending.values())
    batch.result = {"imported": imported, "skipped": len(rows) - imported, "summary": summary(rows),
                    "warnings": batch.result.get("warnings", {})}
    batch.committed_at = timezone.now()
    batch.save(update_fields=["result", "committed_at"])
    return batch.result
