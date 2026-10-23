"""Authenticated, account-scoped HTML and JSON endpoints."""
from datetime import date, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import QuerySet
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie

from . import analytics, apple_health, import_progress, imports
from .models import ImportBatch, SleepNight
from .services import (KINDS, ZONE, fail, lock_user, parse_date, save_record,
                       serialize)

@login_required
@ensure_csrf_cookie
def index(request: HttpRequest) -> HttpResponse:
    return render(request, "quantified_self/index.html")


def date_range(request: Request) -> tuple[date, date]:
    today = timezone.now().astimezone(ZoneInfo(ZONE)).date()
    start = parse_date(request.GET.get("start", (today - timedelta(days=29)).isoformat()))
    end = parse_date(request.GET.get("end", today.isoformat()))
    if start < date(1900, 1, 1) or end < start or (end - start).days > 3660:
        fail("Select dates from 1900 onward, in order, spanning no more than ten years.")
    return start, end


def tracker(kind: str) -> Any:
    if kind not in KINDS:
        fail("Unknown tracker.")
    return KINDS[kind]


def records_query(user: User, kind: str, start: date, end: date) -> QuerySet[Any]:
    query = tracker(kind).objects.filter(user=user).select_related("source")
    if kind == "awakenings":
        return query.select_related("night").filter(night__date__range=(start, end))
    return query.filter(date__range=(start, end))


@api_view(["GET"])
def summary(request: Request) -> Response:
    start, end = date_range(request)
    unit = request.GET.get("unit", "lb")
    if unit not in ("lb", "kg"):
        fail("Unit must be lb or kg.")
    return Response(analytics.dashboard(request.user, start, end, unit))


@api_view(["GET", "POST"])
def records(request: Request, kind: str) -> Response:
    tracker(kind)
    if request.method == "POST":
        row, created = save_record(request.user, kind, request.data)
        return Response(serialize(kind, row), status=201 if created else 200)
    start, end = date_range(request)
    try:
        offset = int(request.GET.get("offset", 0))
        if offset < 0:
            raise ValueError
    except ValueError:
        fail("Invalid page offset.")
    query = records_query(request.user, kind, start, end)
    return Response({"count": query.count(), "results": [serialize(kind, row) for row in query[offset:offset + 50]]})


@api_view(["PUT"])
def record_detail(request: Request, kind: str, uuid: UUID) -> Response:
    row = get_object_or_404(tracker(kind), uuid=uuid, user=request.user)
    row, _ = save_record(request.user, kind, request.data, instance=row)
    return Response(serialize(kind, row))


@api_view(["POST"])
@transaction.atomic
def review_nights(request: Request) -> Response:
    items = request.data.get("nights")
    if not isinstance(items, list) or not 1 <= len(items) <= 366:
        fail("Supply between 1 and 366 nights to review.")
    lock_user(request.user)
    today = timezone.now().astimezone(ZoneInfo(ZONE)).date()
    for item in items:
        if not isinstance(item, dict) or "revision" not in item:
            fail("Each night must include its displayed revision.")
        day = parse_date(item.get("date"))
        if day > today:
            fail("Future nights cannot be reviewed.")
        state = item.get("status")
        if state not in ("complete", "incomplete", "unreviewed"):
            fail("Invalid night status.")
        night = SleepNight.objects.filter(user=request.user, date=day).first()
        revision = night.modified_at.isoformat() if night else None
        if revision != item["revision"]:
            transaction.set_rollback(True)
            return Response({"detail": "Night changed since it was displayed. Refresh and review it again."}, status=409)
        note = str(item.get("note", night.note if night else ""))
        if len(note) > 10000:
            fail("Note is too long.")
        if night is None:
            night = SleepNight(user=request.user, date=day)
        night.status = state
        night.note = note
        night.save()
    return Response({"updated": len(items)})


@api_view(["POST"])
def import_preview(request: Request, kind: str) -> Response:
    upload = request.FILES.get("file")
    if upload is None:
        fail("Choose an Apple Health ZIP file." if kind == "apple-health" else "Choose a CSV file.")
    if kind == "apple-health":
        with import_progress.tracking(request.user, request.data.get("progress_id")) as progress:
            return Response(apple_health.preview(request.user, upload, progress))
    if upload.size > 2 * 1024 * 1024:
        fail("CSV files must be no larger than 2 MB.")
    return Response(imports.preview(request.user, kind, request.data.get("source", "CSV"), upload.read()))


@api_view(["POST"])
def import_commit(request: Request, uuid: UUID) -> Response:
    batch = get_object_or_404(ImportBatch, uuid=uuid, user=request.user)
    if batch.kind == "apple-health":
        with import_progress.tracking(request.user, request.data.get("progress_id")) as progress:
            return Response(apple_health.commit(request.user, batch, progress))
    return Response(imports.commit(request.user, batch, request.data.get("include_duplicates", [])))


@api_view(["GET"])
def import_status(request: Request, uuid: UUID) -> Response:
    response = Response(import_progress.get_progress(request.user, uuid))
    response["Cache-Control"] = "no-store"
    return response


@api_view(["GET"])
def import_history(request: Request) -> Response:
    batches = ImportBatch.objects.filter(user=request.user).select_related("source").order_by("-created_at")[:50]
    return Response([{"uuid": str(b.uuid), "kind": b.kind, "source": b.source.name,
                     "created_at": b.created_at.isoformat(), "committed": b.committed_at is not None,
                     "result": b.result} for b in batches])


@api_view(["GET"])
def download(request: Request, kind: str) -> HttpResponse:
    tracker(kind)
    rows = []
    if request.GET.get("template") != "1":
        start, end = date_range(request)
        source = request.GET.get("source")
        query = records_query(request.user, kind, start, end)
        if source:
            query = query.filter(source__name=source)
        rows = [serialize(kind, row) for row in query]
    response = HttpResponse(imports.csv_text(kind, rows), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{kind}.csv"'
    return response


@api_view(["POST"])
def ingest_awakening(request: Request) -> Response:
    """Record idempotent awakening events from an authenticated listener."""
    if not isinstance(request.data, dict):
        fail("Expected an event object.")
    for field in ("source", "external_id", "timestamp"):
        if not isinstance(request.data.get(field), str) or not request.data[field].strip():
            fail(f"Automatic ingestion requires {field}.")
    row, created = save_record(request.user, "awakenings", request.data)
    return Response(serialize("awakenings", row), status=201 if created else 200)
