"""Date-based charts: missing observations remain missing, never zero-filled."""
from collections import defaultdict
from datetime import date, timedelta
from statistics import mean
from typing import Any
from zoneinfo import ZoneInfo

from django.contrib.auth.models import User

from .models import (AwakeningEvent, BloodPressureReading, SleepNight,
                     WeightReading)
from .services import LB_KG, ZONE, serialize


def average(values: list[float | int]) -> float | None:
    return round(mean(values), 3) if values else None


def dashboard(user: User, start: date, end: date, unit: str) -> dict[str, Any]:
    weights = list(WeightReading.objects.filter(user=user, excluded=False, date__range=(start - timedelta(days=6), end)))
    pressures = list(BloodPressureReading.objects.filter(user=user, excluded=False, date__range=(start - timedelta(days=6), end)))
    weight_days: defaultdict[date, list[float]] = defaultdict(list)
    pressure_days: defaultdict[date, list[BloodPressureReading]] = defaultdict(list)
    weight_rows: defaultdict[date, list[WeightReading]] = defaultdict(list)
    for row in weights:
        weight_rows[row.date].append(row)
        weight_days[row.date].append(float(row.kilograms) / (float(LB_KG) if unit == "lb" else 1))
    for pressure in pressures:
        pressure_days[pressure.date].append(pressure)
    nights = {night.date: night for night in SleepNight.objects.filter(user=user, date__range=(start, end))}
    events = list(AwakeningEvent.objects.filter(user=user, night__date__range=(start, end), excluded=False).select_related("night").order_by("occurred_at"))
    event_days: defaultdict[date, list[dict[str, Any]]] = defaultdict(list)
    histogram = [0] * 24
    for event in events:
        local = event.occurred_at.astimezone(ZoneInfo(event.night.timezone))
        hour = (local.hour - 12) % 24 + local.minute / 60 + local.second / 3600
        event_days[event.night.date].append({"uuid": str(event.uuid), "hour": hour,
            "time": local.strftime("%H:%M:%S %z"), "timestamp": event.occurred_at.isoformat(), "note": event.note})
        histogram[local.hour] += 1
    days: list[dict[str, Any]] = []
    cursor = start
    while cursor <= end:
        night = nights.get(cursor)
        recorded = event_days[cursor]
        window = [cursor - timedelta(days=i) for i in range(7)]
        day_pressures = pressure_days[cursor]
        days.append({
            "date": cursor.isoformat(), "weight": average(weight_days[cursor]),
            "weight_trend": average([mean(weight_days[d]) for d in window if weight_days[d]]),
            "weight_samples": [{"uuid": str(r.uuid), "value": float(r.kilograms) / (float(LB_KG) if unit == "lb" else 1),
                "time": r.time.isoformat() if r.time else "Time unknown"} for r in weight_rows[cursor]],
            "systolic": average([r.systolic for r in day_pressures]),
            "diastolic": average([r.diastolic for r in day_pressures]),
            "pulse": average([r.pulse for r in day_pressures if r.pulse is not None]),
            "systolic_trend": average([mean([r.systolic for r in pressure_days[d]]) for d in window if pressure_days[d]]),
            "diastolic_trend": average([mean([r.diastolic for r in pressure_days[d]]) for d in window if pressure_days[d]]),
            "pressure_samples": [{"uuid": str(r.uuid), "systolic": r.systolic, "diastolic": r.diastolic, "pulse": r.pulse,
                "time": r.time.isoformat() if r.time else "Time unknown"} for r in day_pressures],
            "awakenings": len(recorded) if recorded or (night and night.status == "complete") else None,
            "status": night.status if night else "unreviewed", "revision": night.modified_at.isoformat() if night else None,
            "note": night.note if night else "", "events": recorded,
        })
        if cursor == end:
            break
        cursor += timedelta(days=1)
    reviewed = [d["awakenings"] for d in days if d["status"] == "complete"]
    in_range_pressure = [r for r in pressures if r.date >= start]
    latest_weight = list(WeightReading.objects.filter(user=user, excluded=False).select_related("source")[:2])
    latest_pressure = BloodPressureReading.objects.filter(user=user, excluded=False).select_related("source").first()
    return {"days": days, "timezone": ZONE, "unit": unit,
        "summary": {"completed_nights": len(reviewed), "total_nights": len(days), "mean_awakenings": average(reviewed),
                    "recorded_awakenings": len(events), "weight_days": sum(bool(weight_days[d]) for d in weight_days if d >= start),
                    "pressure_readings": len(in_range_pressure), "pressure_days": len({r.date for r in in_range_pressure}),
                    "mean_systolic": average([r.systolic for r in in_range_pressure]),
                    "mean_diastolic": average([r.diastolic for r in in_range_pressure]),
                    "latest_weight": serialize("weight", latest_weight[0]) if latest_weight else None,
                    "weight_change": round(float(latest_weight[0].kilograms - latest_weight[1].kilograms) / (float(LB_KG) if unit == "lb" else 1), 3) if len(latest_weight) == 2 else None,
                    "latest_pressure": serialize("blood-pressure", latest_pressure) if latest_pressure else None},
        "histogram": [{"hour": f"{i:02d}:00", "count": histogram[i]} for i in list(range(12, 24)) + list(range(12))]}
