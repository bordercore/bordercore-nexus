"""Bounded CSV previews and transactional, repeat-safe imports."""
import csv
import hashlib
import io
from typing import Any

from rest_framework.exceptions import ValidationError

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from .models import DataSource, ImportBatch
from .services import (KINDS, fail, lock_user, normalize, source_for,
                       write_record)

COLUMNS = {
    "awakenings": ["timestamp", "external_id", "note", "excluded", "source", "csv_format"],
    "weight": ["date", "value", "unit", "time", "timezone", "utc_offset", "external_id", "note", "excluded", "source", "csv_format"],
    "blood-pressure": ["date", "systolic", "diastolic", "pulse", "time", "timezone", "utc_offset", "external_id", "note", "excluded", "source", "csv_format"],
}
REQUIRED = {"awakenings": {"timestamp"}, "weight": {"date", "value", "unit"},
            "blood-pressure": {"date", "systolic", "diastolic"}}


def classify(user: User, kind: str, source: DataSource, values: dict[str, Any]) -> str:
    query = KINDS[kind].objects.filter(user=user)
    if values["external_id"] and query.filter(source=source, external_id=values["external_id"]).exists():
        return "existing_id"
    fields = {key: value for key, value in values.items() if key not in ("note", "external_id", "excluded", "kilograms")}
    return "possible_duplicate" if query.filter(**fields).exists() else "new"


def validated_rows(user: User, kind: str, source: DataSource, rows: list[dict[str, str]]) -> list[dict[str, Any]]:
    result = []
    seen_ids = set()
    seen_values = set()
    for number, row in enumerate(rows, start=2):
        item: dict[str, Any] = {"line": number, "data": row, "status": "new", "error": ""}
        try:
            values = normalize(kind, row)
            row_source = source_for(user, row.get("source") or source.name)
            state = classify(user, kind, row_source, values)
            identity = (row_source.pk, values["external_id"]) if values.get("external_id") else None
            signature = tuple((k, str(v)) for k, v in values.items() if k not in ("note", "external_id", "excluded"))
            if identity and identity in seen_ids:
                fail("External ID occurs more than once in this file.")
            if state == "new" and signature in seen_values:
                state = "possible_duplicate"
            if identity:
                seen_ids.add(identity)
            seen_values.add(signature)
            item["status"] = state
        except ValidationError as exc:
            item.update(status="error", error=str(exc.detail.get("detail", exc.detail)))
        result.append(item)
    return result


@transaction.atomic
def preview(user: User, kind: str, source_name: str, content: bytes) -> dict[str, Any]:
    if kind not in COLUMNS:
        fail("Unknown tracker.")
    if len(content) > 2 * 1024 * 1024:
        fail("CSV files must be no larger than 2 MB.")
    try:
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text), strict=True)
        headers = reader.fieldnames or []
        if not REQUIRED[kind].issubset(headers) or len(headers) != len(set(headers)):
            fail("Missing or duplicate CSV columns. Download the template for this tracker.")
        if set(headers) - set(COLUMNS[kind]):
            fail("Unrecognized CSV columns. Use the downloadable template.")
        rows = []
        for row in reader:
            if None in row or any(v is None for v in row.values()):
                fail("A CSV row has the wrong number of columns.")
            encoding = row.pop("csv_format", "")
            if encoding not in ("", "bordercore-v1"):
                fail("Unknown CSV format marker.")
            if encoding:
                row = {key: value[1:] if value.startswith("'") else value for key, value in row.items()}
            rows.append(row)
            if len(rows) > 5000:
                fail("Import at most 5,000 rows at a time.")
    except (UnicodeError, csv.Error):
        fail("Upload a valid UTF-8 CSV file.")
    if not rows:
        fail("The file contains no readings.")
    lock_user(user)
    source = source_for(user, source_name)
    batch, _ = ImportBatch.objects.get_or_create(user=user, source=source, kind=kind,
        digest=hashlib.sha256(content).hexdigest(), defaults={"rows": rows})
    return {"uuid": str(batch.uuid), "committed": batch.committed_at is not None, "result": batch.result,
            "rows": validated_rows(user, kind, source, rows)}


@transaction.atomic
def commit(user: User, batch: ImportBatch, include_duplicates: list[int]) -> dict[str, Any]:
    lock_user(user)
    batch.refresh_from_db()
    if batch.committed_at:
        return batch.result
    if not isinstance(include_duplicates, list) or any(type(x) is not int for x in include_duplicates):
        fail("Duplicate selections must be a list of CSV line numbers.")
    rows = validated_rows(user, batch.kind, batch.source, batch.rows)
    if any(row["status"] == "error" for row in rows):
        fail("Correct all row errors and upload the file again before importing.")
    imported = skipped = 0
    for row in rows:
        if row["status"] == "existing_id" or (row["status"] == "possible_duplicate" and row["line"] not in include_duplicates):
            skipped += 1
            continue
        _, created = write_record(user, batch.kind, normalize(batch.kind, row["data"]), source_for(user, row["data"].get("source") or batch.source.name), batch=batch)
        imported += int(created)
        skipped += int(not created)
    batch.result = {"imported": imported, "skipped": skipped}
    batch.committed_at = timezone.now()
    batch.save(update_fields=["result", "committed_at"])
    return batch.result


def csv_text(kind: str, rows: list[dict[str, Any]]) -> str:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=COLUMNS[kind], extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        cells = {}
        for key in COLUMNS[kind]:
            value = row.get(key, "")
            if isinstance(value, bool):
                value = str(value).lower()
            # Prevent spreadsheet formula evaluation while preserving exact round trips.
            if isinstance(value, str) and value.startswith(("'", "=", "+", "-", "@", "\t", "\r", "\n")):
                value = "'" + value
            cells[key] = value
        cells["csv_format"] = "bordercore-v1"
        writer.writerow(cells)
    return output.getvalue()
