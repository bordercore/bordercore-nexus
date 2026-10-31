"""Selections and known Google Health copies must not create unwanted readings."""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from quantified_self import apple_health
from quantified_self.models import DataSource, ImportBatch, SleepInterval, SleepSession, WeightReading
from .test_apple_health import export, record
from .test_sleep import apple_sleep, interval


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="selection-owner")


def sleep_record(source="Google Health", **kwargs):
    return {**apple_sleep(**kwargs), "sourceName": source}


def select(kind="sleep", source="Google Health"):
    return {"kind": kind, "source": apple_health.source_name(source)}


def preview_batch(owner, records):
    preview = apple_health.preview(owner, export(records))
    return preview, ImportBatch.objects.get(uuid=preview["uuid"])


def test_selecting_source_and_tracker_leaves_others_for_later(owner):
    readings = [sleep_record(), sleep_record("Oura"), record(source="Google Health"), record()]
    preview, batch = preview_batch(owner, readings)
    assert len(preview["groups"]) == 4
    assert all(group["new"] == group["total"] == 1 for group in preview["groups"])
    client = APIClient()
    client.force_authenticate(owner)
    url = f"/quantified-self/imports/{batch.uuid}/commit/"
    response = client.post(url, {"selection": [select()]}, format="json")
    assert response.status_code == 200
    assert response.json()["imported"] == 1
    assert response.json()["skipped"] == 0
    assert SleepInterval.objects.get().source.name == "Apple Health · Google Health"
    assert not WeightReading.objects.exists()
    assert not DataSource.objects.filter(name="Apple Health · Oura").exists()
    batch.refresh_from_db()
    assert batch.committed_at is None
    receipt = SleepInterval.objects.get().import_batch
    assert receipt.pk != batch.pk and len(receipt.rows) == 1 and receipt.committed_at
    assert client.post(url, {"selection": [select()]}, format="json").json() == response.json()
    assert SleepInterval.objects.count() == 1
    updated, same_batch = preview_batch(owner, readings)
    assert same_batch.pk == batch.pk
    assert sum(group["new"] for group in updated["groups"]) == 3
    assert sum(group["existing"] for group in updated["groups"]) == 1
    result = client.post(url, {"selection": [select(source="Oura"), select("weight", "Scale")]}, format="json")
    assert result.json()["imported"] == 2
    assert WeightReading.objects.get().source.name == "Apple Health · Scale"
    assert SleepInterval.objects.count() == 2
    assert apple_health.commit(owner, batch)["imported"] == 1
    assert WeightReading.objects.count() == 2


@pytest.mark.parametrize("selection", [
    None, [], "all", {}, [None], [{"kind": "sleep"}],
    [{"kind": ["sleep"], "source": "Apple Health · Google Health"}],
    [select(source="Oura")], [select("weight")],
    [{**select(), "extra": True}],
])
def test_bad_selection_never_falls_back_to_importing_everything(owner, selection):
    _, batch = preview_batch(owner, [sleep_record(), record()])
    client = APIClient()
    client.force_authenticate(owner)
    response = client.post(f"/quantified-self/imports/{batch.uuid}/commit/", {"selection": selection}, format="json")
    assert response.status_code == 400
    assert not SleepInterval.objects.exists() and not WeightReading.objects.exists()
    assert not ImportBatch.objects.filter(committed_at__isnull=False).exists()
    assert ImportBatch.objects.count() == 1


def test_selection_cannot_commit_another_accounts_preview(owner):
    _, batch = preview_batch(owner, [sleep_record(), record()])
    client = APIClient()
    client.force_authenticate(User.objects.create_user(username="selection-other"))
    assert client.post(f"/quantified-self/imports/{batch.uuid}/commit/", {"selection": [select()]}, format="json").status_code == 404
    assert not SleepInterval.objects.exists()


def test_known_google_copies_skip_exact_intervals_and_session_bounds(owner):
    original = interval(owner, source="Google Health", stage="light", excluded=True)
    SleepSession.objects.create(user=owner, source=original.source, date=original.date,
        started_at=original.started_at, ended_at=original.ended_at, asleep_seconds=7 * 3600)
    other = User.objects.create_user(username="google-other")
    interval(other, source="Google Health", stage="rem")
    preview, batch = preview_batch(owner, [
        sleep_record(), sleep_record(stage="InBed"),
        sleep_record(stage="AsleepREM"),  # different stage is not an exact copy
        sleep_record(start="2026-01-09 23:00:01 -0500"),  # overlap is not an exact copy
        sleep_record("Oura"),  # same interval, distinct source
    ])
    google = next(g for g in preview["groups"] if g["source"] == "Apple Health · Google Health")
    assert (google["new"], google["existing"]) == (2, 2)
    assert sum(r["status"] == "existing_google_health" for r in preview["rows"]) == 2
    result = apple_health.commit(owner, batch, selection=[select()])
    assert (result["imported"], result["skipped"]) == (2, 2)
    assert not SleepInterval.objects.filter(user=owner, source__name="Apple Health · Oura").exists()
    original.refresh_from_db()
    assert original.excluded
    assert SleepSession.objects.count() == 1
    assert SleepInterval.objects.filter(user=owner, source__name="Google Health").count() == 1


def test_google_copies_are_rechecked_when_committing(owner):
    preview, batch = preview_batch(owner, [sleep_record(), record()])
    assert next(g for g in preview["groups"] if g["kind"] == "sleep")["new"] == 1
    interval(owner, source="Google Health", stage="light")
    result = apple_health.commit(owner, batch, selection=[select()])
    assert (result["imported"], result["skipped"]) == (0, 1)
    assert not SleepInterval.objects.filter(source__name="Apple Health · Google Health").exists()
    assert not WeightReading.objects.exists()
