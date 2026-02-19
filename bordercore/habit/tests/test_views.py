import pytest

from django import urls

from habit.models import HabitLog

pytestmark = [pytest.mark.django_db]


def test_habit_list_empty(authenticated_client):

    _, client = authenticated_client()

    url = urls.reverse("habit:list")
    resp = client.get(url)

    assert resp.status_code == 200


def test_habit_list(authenticated_client, habit):

    _, client = authenticated_client()

    url = urls.reverse("habit:list")
    resp = client.get(url)

    assert resp.status_code == 200
    assert "habits_json" in resp.context


def test_habit_detail(authenticated_client, habit):

    _, client = authenticated_client()

    url = urls.reverse("habit:detail", kwargs={"uuid": habit.uuid})
    resp = client.get(url)

    assert resp.status_code == 200
    assert "habit_json" in resp.context


def test_get_habits_api(authenticated_client, habit):

    _, client = authenticated_client()

    url = urls.reverse("habit:get_habits")
    resp = client.get(url)

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "OK"
    assert len(data["habits"]) >= 1


def test_log_habit_create(authenticated_client, habit):

    _, client = authenticated_client()

    url = urls.reverse("habit:log")
    resp = client.post(url, {
        "habit_uuid": str(habit.uuid),
        "date": "2025-06-15",
        "completed": "true",
        "note": "Good day",
    })

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "OK"
    assert data["log"]["completed"] is True
    assert data["log"]["date"] == "2025-06-15"


def test_log_habit_update(authenticated_client, habit):

    _, client = authenticated_client()

    url = urls.reverse("habit:log")

    # Create a log entry
    client.post(url, {
        "habit_uuid": str(habit.uuid),
        "date": "2025-06-16",
        "completed": "true",
    })

    # Update the same date
    resp = client.post(url, {
        "habit_uuid": str(habit.uuid),
        "date": "2025-06-16",
        "completed": "false",
        "note": "Changed my mind",
    })

    assert resp.status_code == 200
    data = resp.json()
    assert data["log"]["completed"] is False
    assert data["log"]["note"] == "Changed my mind"

    # Verify only one log for that date
    logs = HabitLog.objects.filter(habit=habit, date="2025-06-16")
    assert logs.count() == 1


def test_log_habit_missing_fields(authenticated_client, habit):

    _, client = authenticated_client()

    url = urls.reverse("habit:log")
    resp = client.post(url, {
        "habit_uuid": str(habit.uuid),
    })

    assert resp.status_code == 400


def test_log_habit_invalid_date(authenticated_client, habit):

    _, client = authenticated_client()

    url = urls.reverse("habit:log")
    resp = client.post(url, {
        "habit_uuid": str(habit.uuid),
        "date": "not-a-date",
        "completed": "true",
    })

    assert resp.status_code == 400
