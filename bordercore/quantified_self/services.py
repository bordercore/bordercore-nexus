"""Shared validation and atomic writes for the website, imports and ingestion.

All writes serialize on the owning user row, including night review and imports.
This keeps retry handling and completeness invalidation consistent under races.
"""
import re
from datetime import date, datetime, time, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal, InvalidOperation
from typing import Any, NoReturn, cast
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from rest_framework.exceptions import ValidationError

from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from .models import (AwakeningEvent, BloodPressureReading, DataSource,
                     ImportBatch, SleepNight, WeightReading)

ZONE = "America/New_York"
KINDS: dict[str, type[AwakeningEvent] | type[WeightReading] | type[BloodPressureReading]] = {"awakenings": AwakeningEvent, "weight": WeightReading, "blood-pressure": BloodPressureReading}
LB_KG = Decimal("0.45359237")


def fail(message: str) -> NoReturn:
    raise ValidationError({"detail": message})


def lock_user(user: User) -> None:
    get_user_model().objects.select_for_update().get(pk=user.pk)


def parse_date(value: Any) -> date:
    try:
        if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", str(value)):
            raise ValueError
        parsed = date.fromisoformat(str(value))
        if parsed < date(1900, 1, 1):
            fail("Dates must be 1900 or later.")
        return parsed
    except (ValueError, TypeError):
        fail("Use an ISO date: YYYY-MM-DD.")


def parse_timestamp(value: Any) -> datetime:
    try:
        result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if result.utcoffset() is None:
            fail("Timestamp must include a UTC offset, for example 2026-10-21T02:15:00-04:00.")
        utc = result.astimezone(dt_timezone.utc)
        if utc.astimezone(ZoneInfo(ZONE)).date() < date(1900, 1, 1):
            fail("Dates must be 1900 or later.")
        return utc
    except (ValueError, TypeError, OverflowError):
        fail("Invalid timestamp; include its UTC offset.")


def local_timestamp(day: date, clock: time, zone: ZoneInfo, offset: Any = "") -> datetime:
    """Reject nonexistent times, and require an offset for ambiguous local times."""
    naive = datetime.combine(day, clock)
    candidates = {}
    for fold in (0, 1):
        aware = naive.replace(tzinfo=zone, fold=fold)
        utc = aware.astimezone(dt_timezone.utc)
        if utc.astimezone(zone).replace(tzinfo=None) == naive:
            candidates[aware.strftime("%z")] = utc
    if not candidates:
        fail("This local time does not exist because the clocks change. Correct the time.")
    if offset:
        key = str(offset).replace(":", "")
        if key not in candidates:
            fail("UTC offset does not match the measurement's local time and timezone.")
        return candidates[key]
    if len(candidates) > 1:
        fail("This time occurs twice when the clocks change. Supply utc_offset (for example -04:00 or -05:00).")
    return next(iter(candidates.values()))


def positive_integer(value: Any, label: str, optional: bool = False) -> int | None:
    if optional and value in ("", None):
        return None
    raw = str(value)
    if len(raw) > 5 or not raw.isascii() or not raw.isdigit() or not 0 < int(raw) <= 32767:
        fail(f"{label} must be a positive whole number below 32768.")
    return int(raw)


def normalize(kind: str, data: dict[str, Any]) -> dict[str, Any]:
    if kind not in KINDS:
        fail("Unknown tracker.")
    if not isinstance(data, dict):
        fail("Expected a record object.")
    note = str(data.get("note", "") or "")
    external_id = str(data.get("external_id", "") or "").strip() or None
    if len(note) > 10000 or (external_id and len(external_id) > 200):
        fail("Note or external ID is too long.")
    excluded = data.get("excluded", False)
    if excluded not in (True, False, "true", "false", "", "0", "1"):
        fail("Excluded must be true or false.")
    values: dict[str, Any] = {"note": note, "external_id": external_id, "excluded": excluded in (True, "true", "1")}
    if kind == "awakenings":
        if data.get("timestamp"):
            values["occurred_at"] = parse_timestamp(data["timestamp"])
        else:
            try:
                awakening_clock = time.fromisoformat(str(data.get("time", "")))
                if awakening_clock.tzinfo is not None:
                    fail("Use a local time and a separate UTC offset.")
            except ValueError:
                fail("An awakening requires a time.")
            values["occurred_at"] = local_timestamp(parse_date(data.get("date")), awakening_clock, ZoneInfo(ZONE), data.get("utc_offset"))
        if values["occurred_at"] > timezone.now() + timedelta(minutes=5):
            fail("An awakening cannot be in the future.")
        return values
    day = parse_date(data.get("date"))
    zone_name = str(data.get("timezone") or ZONE)
    try:
        zone = ZoneInfo(zone_name)
    except (ValueError, ZoneInfoNotFoundError):
        fail("Unknown timezone.")
    clock = None
    occurred_at = None
    if data.get("time"):
        try:
            clock = time.fromisoformat(str(data["time"]))
            if clock.tzinfo is not None or clock.microsecond:
                fail("Use a local time without an offset; put the offset in utc_offset.")
        except (TypeError, ValueError):
            fail("Invalid time; use HH:MM or HH:MM:SS.")
        occurred_at = local_timestamp(day, clock, zone, data.get("utc_offset"))
    if day > timezone.now().astimezone(zone).date() or (occurred_at and occurred_at > timezone.now() + timedelta(minutes=5)):
        fail("A measurement cannot be in the future.")
    values.update(date=day, time=clock, timezone=zone_name, occurred_at=occurred_at)
    if kind == "weight":
        try:
            value = Decimal(str(data.get("value")))
            if not value.is_finite() or not 0 < value < 1000000 or cast(int, value.as_tuple().exponent) < -3:
                fail("Weight must be positive, below 1,000,000, with at most three decimal places.")
        except (InvalidOperation, ValueError):
            fail("Enter a valid weight.")
        unit = data.get("unit")
        if unit not in ("lb", "kg"):
            fail("Weight unit must be lb or kg.")
        values.update(value=value, unit=unit, kilograms=(value * (LB_KG if unit == "lb" else 1)).quantize(Decimal("0.000001")))
    else:
        values.update(systolic=positive_integer(data.get("systolic"), "Systolic"),
                      diastolic=positive_integer(data.get("diastolic"), "Diastolic"),
                      pulse=positive_integer(data.get("pulse"), "Pulse", optional=True))
        if values["systolic"] <= values["diastolic"]:
            fail("Systolic must be higher than diastolic; check the entered values.")
    return values


def source_for(user: User, name: Any) -> DataSource:
    name = str(name or "Manual").strip()
    if not name or len(name) > 100:
        fail("Source name must contain 1–100 characters.")
    return DataSource.objects.get_or_create(user=user, name=name)[0]


def night_for(user: User, timestamp: datetime) -> SleepNight:
    local = timestamp.astimezone(ZoneInfo(ZONE))
    morning = local.date() + (timedelta(days=1) if local.hour >= 12 else timedelta())
    return SleepNight.objects.get_or_create(user=user, date=morning, defaults={"timezone": ZONE})[0]


def reopen(night: SleepNight) -> None:
    night.status = "unreviewed"
    night.save(update_fields=["status", "modified_at"])


def write_record(user: User, kind: str, values: dict[str, Any], source: DataSource, batch: ImportBatch | None = None, instance: Any = None) -> tuple[Any, bool]:
    """Caller holds the user lock in a transaction. Existing source IDs never overwrite."""
    model = KINDS[kind]
    if instance is None and values.get("external_id"):
        existing = model.objects.filter(user=user, source=source, external_id=values["external_id"]).first()
        if existing:
            return existing, False
    old_night = instance.night if instance is not None and kind == "awakenings" else None
    if kind == "awakenings":
        values = {**values, "night": night_for(user, values["occurred_at"])}
    if instance is None:
        instance = model.objects.create(user=user, source=source, import_batch=batch, **values)
    else:
        # A website correction never changes provenance or the retry identity.
        for key, value in values.items():
            if key != "external_id":
                setattr(instance, key, value)
        instance.save()
    if kind == "awakenings":
        reopen(instance.night)
        if old_night and old_night.pk != instance.night_id:
            reopen(old_night)
    return instance, True


@transaction.atomic
def save_record(user: User, kind: str, data: dict[str, Any], instance: Any = None) -> tuple[Any, bool]:
    values = normalize(kind, data)
    lock_user(user)
    if instance is not None:
        instance.refresh_from_db()
    source = instance.source if instance else source_for(user, data.get("source", "Manual"))
    return write_record(user, kind, values, source, instance=instance)


def serialize(kind: str, row: Any) -> dict[str, Any]:
    result = {"uuid": str(row.uuid), "source": row.source.name, "external_id": row.external_id or "",
              "note": row.note, "excluded": row.excluded, "created_at": row.created_at.isoformat()}
    if kind == "awakenings":
        result.update(timestamp=row.occurred_at.astimezone(ZoneInfo(row.night.timezone)).isoformat(), date=row.night.date.isoformat())
    else:
        result.update(date=row.date.isoformat(), time=row.time.isoformat() if row.time else "", timezone=row.timezone,
                      utc_offset=row.occurred_at.astimezone(ZoneInfo(row.timezone)).strftime("%z") if row.occurred_at else "")
        if kind == "weight":
            result.update(value=str(row.value), unit=row.unit, kilograms=float(row.kilograms))
        else:
            result.update(systolic=row.systolic, diastolic=row.diastolic, pulse=row.pulse)
    return result
