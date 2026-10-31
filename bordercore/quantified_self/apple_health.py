"""Stream Apple Health ZIP exports into repeat-safe measurement batches."""
import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone as dt_timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from time import monotonic
from typing import Any, BinaryIO
from zipfile import BadZipFile, ZipFile
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from zlib import error as ZlibError

from lxml import etree

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from .models import ImportBatch, SleepInterval, SleepSession
from .sleep import morning_date, normalize_interval
from .import_progress import Progress
from .services import CARDIAC_UNITS, KINDS, LB_KG, ZONE, fail, lock_user, normalize, source_for

MAX_ZIP_BYTES = 512 * 1024 * 1024
MAX_XML_BYTES = 4 * 1024 * 1024 * 1024
MAX_READINGS = 100000
IMPORT_MODELS = {**KINDS, "sleep": SleepInterval}
HEALTH_KINDS = ("weight", "blood-pressure", "resting-heart-rate", "hrv", "sleep")
SLEEP_STAGES = {
    "HKCategoryValueSleepAnalysisInBed": "in_bed",
    "HKCategoryValueSleepAnalysisAwake": "awake",
    "HKCategoryValueSleepAnalysisAsleep": "asleep",
    "HKCategoryValueSleepAnalysisAsleepUnspecified": "asleep",
    "HKCategoryValueSleepAnalysisAsleepCore": "light",
    "HKCategoryValueSleepAnalysisAsleepDeep": "deep",
    "HKCategoryValueSleepAnalysisAsleepREM": "rem",
}
TYPES = {
    "HKCategoryTypeIdentifierSleepAnalysis": "sleep",
    "HKQuantityTypeIdentifierRestingHeartRate": "resting-heart-rate",
    "HKQuantityTypeIdentifierHeartRateVariabilitySDNN": "hrv",
    "HKQuantityTypeIdentifierBodyMass": "weight",
    "HKQuantityTypeIdentifierBloodPressureSystolic": "systolic",
    "HKQuantityTypeIdentifierBloodPressureDiastolic": "diastolic",
}


def normalize_import(kind: str, data: dict[str, Any]) -> dict[str, Any]:
    return normalize_interval(data) if kind == "sleep" else normalize(kind, data)


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
            fail("This export contains too many supported measurement entries (limit 1,000,000).")
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
        if kind == "sleep":
            stage = SLEEP_STAGES.get(record.get("value", ""))
            if stage is None:
                fail("Unknown Apple Health sleep stage.")
            data.update(start=start.isoformat(), end=end.isoformat(), stage=stage,
                        date=morning_date(start).isoformat())
            self.add("sleep", data, ["sleep", source, start.isoformat(), end.isoformat(), stage])
            return
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
            elif kind in CARDIAC_UNITS:
                expected = "count/min" if kind == "resting-heart-rate" else "ms"
                if record.get("unit") != expected:
                    fail(f"Apple Health {kind} units must be {expected}.")
                value = value.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
                data.update(value=str(value), unit=CARDIAC_UNITS[kind])
                self.add(kind, data, [kind, source, start.isoformat(), str(value)])
            else:
                if record.get("unit") != "mmHg" or value != value.to_integral_value():
                    fail("Apple Health blood pressure must be whole numbers in mmHg.")
                key = (source, start.isoformat(), end.isoformat())
                pair = self.pressure.setdefault(key, {"data": data, "systolic": set(), "diastolic": set()})
                if int(value) in pair[kind]:
                    self.repeated += 1
                pair[kind].add(int(value))
                if len(self.pressure) > MAX_READINGS:
                    fail("Import at most 100,000 distinct readings at a time.")
        except (InvalidOperation, ValueError):
            fail("An Apple Health measurement has an invalid value.")

    def add(self, kind: str, data: dict[str, str], identity: list[Any]) -> None:
        external_id = "apple-health-v1:" + fingerprint(identity)
        data["external_id"] = external_id
        normalize_import(kind, data)
        if external_id in self.rows:
            self.repeated += 1
        else:
            self.rows[external_id] = {"kind": kind, "data": data}
        if len(self.rows) > MAX_READINGS:
            fail("Import at most 100,000 distinct readings at a time.")

    def counts(self) -> dict[str, int]:
        return {kind.replace("-", "_"): sum(row["kind"] == kind for row in self.rows.values())
                for kind in ("weight", "resting-heart-rate", "hrv", "sleep")}

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
            fail("No supported measurements were found in this export.")
        return rows, {"repeated_entries": self.repeated, "incomplete_pressure": incomplete,
                      "ambiguous_pressure": ambiguous}


def parse_zip(upload: BinaryIO, progress: Progress | None = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
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
                last_update = 0.0
                while chunk := stream.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_XML_BYTES:
                        fail("The Apple Health XML must be no larger than 4 GB.")
                    parser.feed(chunk)
                    now = monotonic()
                    if progress and (now - last_update >= 0.3 or size == entry.file_size):
                        progress("scanning", loaded=size, total=entry.file_size,
                                 **target.counts(), blood_pressure=sum(
                                     len(pair["systolic"]) == len(pair["diastolic"]) == 1
                                     for pair in target.pressure.values()), duplicates=target.repeated)
                        last_update = now
                parser.close()
    except (BadZipFile, etree.XMLSyntaxError, RuntimeError, NotImplementedError, EOFError, ZlibError):
        fail("Unable to read this Apple Health ZIP. Upload an intact, unencrypted export.")
    if progress:
        progress("pairing", **target.counts(), blood_pressure=sum(
            len(pair["systolic"]) == len(pair["diastolic"]) == 1 for pair in target.pressure.values()))
    return target.finish()


def classified_rows(user: User, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    existing: dict[str, set[tuple[str, str | None]]] = {}
    for kind in HEALTH_KINDS:
        sources = {row["data"]["source"] for row in rows if row["kind"] == kind}
        existing[kind] = set(IMPORT_MODELS[kind].objects.filter(user=user, source__name__in=sources)
                             .values_list("source__name", "external_id"))
    # Google Health can write copies of its own records to Apple Health. Only
    # this known source pair is equivalent; other devices remain independent.
    google_copies = [row for row in rows if row["kind"] == "sleep"
                     and row["data"]["source"] == source_name("Google Health")]
    google_intervals: set[tuple[datetime, datetime, str]] = set()
    if google_copies:
        filters = {"user": user, "source__name": "Google Health",
                   "started_at__gte": min(datetime.fromisoformat(row["data"]["start"]) for row in google_copies),
                   "started_at__lte": max(datetime.fromisoformat(row["data"]["start"]) for row in google_copies)}
        google_intervals.update(SleepInterval.objects.filter(**filters).values_list("started_at", "ended_at", "stage"))
        google_intervals.update((start, end, "in_bed") for start, end in
                                SleepSession.objects.filter(**filters).values_list("started_at", "ended_at"))
    classified = []
    for row in rows:
        data = row["data"]
        status = "existing_id" if (data["source"], data["external_id"]) in existing[row["kind"]] else "new"
        if (status == "new" and row["kind"] == "sleep" and data["source"] == source_name("Google Health")
                and (datetime.fromisoformat(data["start"]), datetime.fromisoformat(data["end"]), data["stage"]) in google_intervals):
            status = "existing_google_health"
        classified.append({**row, "status": status})
    return classified


def summary(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for kind in HEALTH_KINDS:
        readings = [row for row in rows if row["kind"] == kind]
        dates = [row["data"]["date"] for row in readings]
        result.append({"kind": kind, "total": len(readings), "new": sum(row["status"] == "new" for row in readings),
                       "existing": sum(row["status"] != "new" for row in readings),
                       "first_date": min(dates) if dates else None, "last_date": max(dates) if dates else None,
                       "sources": sorted({row["data"]["source"] for row in readings})})
    return result


def source_summary(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        groups[row["kind"], row["data"]["source"]].append(row)
    return [{**next(item for item in summary(readings) if item["kind"] == kind), "source": source}
            for (kind, source), readings in sorted(groups.items(), key=lambda item: (HEALTH_KINDS.index(item[0][0]), item[0][1]))]


def preview(user: User, upload: BinaryIO, progress: Progress | None = None) -> dict[str, Any]:
    rows, warnings = parse_zip(upload, progress)
    if progress:
        progress("checking", **{kind.replace("-", "_"): sum(row["kind"] == kind for row in rows)
                 for kind in HEALTH_KINDS})
    # No database lock is held while processing a potentially multi-GB XML file.
    with transaction.atomic():
        lock_user(user)
        batch, _ = ImportBatch.objects.get_or_create(user=user, source=source_for(user, "Apple Health"),
            kind="apple-health", digest=fingerprint(rows), defaults={"rows": rows, "result": {"warnings": warnings}})
        classified = classified_rows(user, rows)
        return {"uuid": str(batch.uuid), "committed": batch.committed_at is not None, "result": batch.result,
                "summary": summary(classified), "groups": source_summary(classified), "warnings": warnings,
                "rows": sorted(classified, key=lambda r: (r["data"]["date"], r["data"]["time"]), reverse=True)[:50]}


def selected_rows(rows: list[dict[str, Any]], selection: Any) -> list[dict[str, Any]]:
    """Validate explicit tracker/source pairs; never fall back to importing all."""
    if not isinstance(selection, list) or not selection:
        fail("Choose at least one tracker and source to import.")
    available = {(row["kind"], row["data"]["source"]) for row in rows}
    selected = set()
    for item in selection:
        if (not isinstance(item, dict) or set(item) != {"kind", "source"}
                or not isinstance(item["kind"], str) or not isinstance(item["source"], str)
                or (item["kind"], item["source"]) not in available):
            fail("Choose tracker and source combinations from this preview.")
        selected.add((item["kind"], item["source"]))
    return [row for row in rows if (row["kind"], row["data"]["source"]) in selected]


@transaction.atomic
def commit(user: User, batch: ImportBatch, progress: Progress | None = None, selection: Any = None) -> dict[str, Any]:
    if progress:
        progress("checking")
    lock_user(user)
    batch.refresh_from_db()
    if selection is not None:
        chosen = selected_rows(batch.rows, selection)
        if len(chosen) != len(batch.rows):
            # A subset gets its own repeat-safe receipt. The original preview
            # stays available so omitted sources can be imported later.
            batch, _ = ImportBatch.objects.get_or_create(user=user, source=batch.source,
                kind="apple-health", digest=fingerprint(chosen),
                defaults={"rows": chosen, "result": {"warnings": batch.result.get("warnings", {})}})
    if batch.committed_at:
        return batch.result
    rows = classified_rows(user, batch.rows)
    sources = {name: source_for(user, name) for name in {row["data"]["source"] for row in rows if row["status"] == "new"}}
    pending: dict[str, list[Any]] = defaultdict(list)
    for index, row in enumerate(rows, start=1):
        if row["status"] == "new":
            pending[row["kind"]].append(IMPORT_MODELS[row["kind"]](user=user, source=sources[row["data"]["source"]],
                import_batch=batch, **normalize_import(row["kind"], row["data"])))
        if progress and (index % 500 == 0 or index == len(rows)):
            progress("validating", processed=index, total=len(rows))
    total = sum(len(records) for records in pending.values())
    written = 0
    for kind, records in pending.items():
        for start in range(0, len(records), 500):
            chunk = records[start:start + 500]
            if progress:
                progress("saving", kind=kind, processed=written, total=total)
            IMPORT_MODELS[kind].objects.bulk_create(chunk, batch_size=500)
            written += len(chunk)
    imported = sum(len(records) for records in pending.values())
    batch.result = {"imported": imported, "skipped": len(rows) - imported, "summary": summary(rows),
                    "warnings": batch.result.get("warnings", {})}
    batch.committed_at = timezone.now()
    batch.save(update_fields=["result", "committed_at"])
    if progress:
        progress("finalizing", processed=written, total=total, skipped=len(rows) - imported)
    return batch.result
