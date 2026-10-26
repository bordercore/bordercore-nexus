"""Sleep duration and stages, kept separate from self-reported awakenings."""
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone as dt_timezone
from statistics import mean
from typing import Any, Iterable
from zoneinfo import ZoneInfo

from django.contrib.auth.models import User
from django.db.models import Count, Max
from django.utils import timezone

from .models import AwakeningEvent, DataSource, SleepInterval, SleepSession
from .services import ZONE, fail, parse_timestamp

ASLEEP = ("light", "deep", "rem", "asleep")
STAGES = (*ASLEEP, "awake", "restless", "in_bed")


def morning_date(start: datetime) -> date:
    local = start.astimezone(ZoneInfo(ZONE))
    return local.date() + timedelta(days=local.hour >= 12)


def normalize_interval(data: dict[str, Any]) -> dict[str, Any]:
    start, end = parse_timestamp(data.get("start")), parse_timestamp(data.get("end"))
    if not start < end <= start + timedelta(days=2):
        fail("A sleep interval must end after it starts and last no more than 48 hours.")
    if end > timezone.now() + timedelta(minutes=5):
        fail("A sleep interval cannot end in the future.")
    stage = data.get("stage")
    if stage not in STAGES:
        fail("Unknown sleep stage.")
    external_id = str(data.get("external_id") or "")
    if len(external_id) > 200:
        fail("Sleep interval ID is too long.")
    return {"date": morning_date(start), "started_at": start, "ended_at": end,
            "stage": stage, "external_id": external_id or None}


def chosen_sessions(rows: Iterable[SleepSession]) -> list[SleepSession]:
    """Google exports v1 and v2 estimates for the same sleep. Prefer v2 on overlap.

    Retain nonoverlapping sessions (including naps). Unrecognized versions use
    the source's update timestamp; the import timestamp cannot decide quality.
    """
    floor = datetime.min.replace(tzinfo=dt_timezone.utc)
    ranked = sorted(rows, key=lambda row: (
        {"sleep_session_v2": 2, "sleep_session_v1": 1}.get(row.algorithm_version, 0),
        row.source_updated_at or floor, row.pk,
    ), reverse=True)
    selected: list[SleepSession] = []
    for row in ranked:
        if not any(row.started_at < other.ended_at and row.ended_at > other.started_at for other in selected):
            selected.append(row)
    return sorted(selected, key=lambda row: row.started_at)


def merged_intervals(rows: Iterable[SleepInterval]) -> list[dict[str, Any]]:
    """Resolve overlaps without counting a second twice or inventing a stage.

    Awake overrides sleep; detailed sleep overrides unspecified sleep/in-bed.
    Conflicting detailed stages become unspecified sleep. Bed/restless-only
    intervals never imply sleep.
    """
    boundaries: defaultdict[datetime, Counter[str]] = defaultdict(Counter)
    for row in rows:
        boundaries[row.started_at][row.stage] += 1
        boundaries[row.ended_at][row.stage] -= 1
    active: Counter[str] = Counter()
    result: list[dict[str, Any]] = []
    times = sorted(boundaries)
    for i, start in enumerate(times[:-1]):
        active.update(boundaries[start])
        end = times[i + 1]
        detailed = [stage for stage in ("light", "deep", "rem") if active[stage] > 0]
        stage = ("awake" if active["awake"] > 0 else
                 detailed[0] if len(detailed) == 1 else
                 "asleep" if detailed or active["asleep"] > 0 else
                 "restless" if active["restless"] > 0 else
                 "in_bed" if active["in_bed"] > 0 else None)
        if not stage:
            continue
        if result and result[-1]["end"] == start and result[-1]["stage"] == stage:
            result[-1]["end"] = end
        else:
            result.append({"start": start, "end": end, "stage": stage})
    return result


def interval_seconds(spans: list[dict[str, Any]]) -> float:
    return sum((span["end"] - span["start"]).total_seconds() for span in spans)


def night_data(day: date, sessions: list[SleepSession], intervals: list[SleepInterval]) -> dict[str, Any]:
    selected = chosen_sessions(sessions)
    selected_ids = {session.pk for session in selected}
    usable = [row for row in intervals if row.session_id is None or row.session_id in selected_ids]
    spans = merged_intervals(usable)
    totals = {stage: interval_seconds([span for span in spans if span["stage"] == stage]) for stage in STAGES}
    # Preserve in-bed coverage independently of more-specific overlaid stages.
    bed_spans = merged_intervals([row for row in usable if row.stage == "in_bed"])
    totals["in_bed"] = interval_seconds(bed_spans)
    has_asleep = any(totals[stage] > 0 for stage in ASLEEP)
    reported = bool(selected) and all(row.asleep_seconds is not None for row in selected)
    seconds: float | None = None
    if reported:
        seconds = sum(float(row.asleep_seconds or 0) for row in selected)
    elif has_asleep:
        seconds = sum(totals[stage] for stage in ASLEEP)
    bounds = [(r.started_at, r.ended_at) for r in selected] or [(r.started_at, r.ended_at) for r in usable]
    return {"date": day.isoformat(), "asleep_seconds": seconds,
            "duration_basis": "reported" if reported else "stages" if has_asleep else None,
            "stages": totals, "session_count": len(selected),
            "bedtime": min(b[0] for b in bounds).isoformat() if bounds else None,
            "wake_time": max(b[1] for b in bounds).isoformat() if bounds else None,
            "intervals": [{**span, "start": span["start"].isoformat(), "end": span["end"].isoformat()} for span in spans]}


def source_options(user: User) -> list[dict[str, Any]]:
    latest: dict[int, datetime] = {}
    for model in (SleepSession, SleepInterval):
        for item in model.objects.filter(user=user, excluded=False).values("source_id").annotate(latest=Max("ended_at")):
            identifier = item["source_id"]
            latest[identifier] = max(latest.get(identifier, item["latest"]), item["latest"])
    sources = DataSource.objects.filter(user=user, pk__in=latest)
    return [{"id": s.pk, "name": s.name, "latest": latest[s.pk].isoformat()}
            for s in sorted(sources, key=lambda s: (latest[s.pk], s.pk), reverse=True)]


def dashboard(user: User, start: date, end: date, source: str = "", detail: bool = False) -> dict[str, Any]:
    options = source_options(user)
    selected = next((s for s in options if str(s["id"]) == source), None) if source else next(iter(options), None)
    if source and selected is None:
        fail("Unknown sleep source.")
    lookback = start - timedelta(days=6)
    session_days: defaultdict[date, list[SleepSession]] = defaultdict(list)
    interval_days: defaultdict[date, list[SleepInterval]] = defaultdict(list)
    if selected:
        filters = {"user": user, "source_id": selected["id"], "excluded": False, "date__range": (lookback, end)}
        for session in SleepSession.objects.filter(**filters):
            session_days[session.date].append(session)
        for interval in SleepInterval.objects.filter(**filters):
            interval_days[interval.date].append(interval)
    all_days = {}
    cursor = lookback
    while cursor <= end:
        all_days[cursor] = night_data(cursor, session_days[cursor], interval_days[cursor])
        cursor += timedelta(days=1)
    presses = {row["night__date"]: row["count"] for row in AwakeningEvent.objects.filter(
        user=user, excluded=False, night__date__range=(start, end)
    ).values("night__date").annotate(count=Count("id"))}
    days = []
    for day, row in all_days.items():
        if day < start:
            continue
        values = [all_days[day - timedelta(days=i)]["asleep_seconds"] for i in range(7)]
        present = [value for value in values if value is not None]
        row["recorded_awakenings"] = presses.get(day, 0)
        row["trend_seconds"] = round(mean(present), 1) if present else None
        if not detail:
            del row["intervals"]
        days.append(row)
    recorded = [row for row in days if row["asleep_seconds"] is not None]
    result = {"days": days, "sources": options, "source": selected, "timezone": ZONE,
              "summary": {"nights": len(recorded),
                          "mean_seconds": round(mean([row["asleep_seconds"] for row in recorded]), 1) if recorded else None,
                          "latest": recorded[-1] if recorded else None}}
    if detail:
        events = AwakeningEvent.objects.filter(user=user, excluded=False, night__date__range=(start, end)).select_related("source").order_by("occurred_at")
        result["events"] = [{"uuid": str(event.uuid), "timestamp": event.occurred_at.isoformat(), "source": event.source.name} for event in events]
    return result
