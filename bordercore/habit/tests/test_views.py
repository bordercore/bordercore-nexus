from datetime import date

import pytest

from django import urls

from accounts.tests.factories import UserFactory
from habit.models import Habit, HabitLog, HabitNote
from habit.tests.factories import HabitFactory

pytestmark = [pytest.mark.django_db]


def test_habit_list_empty(authenticated_client):

    _, client = authenticated_client()

    url = urls.reverse("habit:list")
    resp = client.get(url)

    assert resp.status_code == 200


def test_habit_list(authenticated_client):

    user, client = authenticated_client()
    HabitFactory(user=user, start_date=date.today())

    url = urls.reverse("habit:list")
    resp = client.get(url)

    assert resp.status_code == 200
    assert "habits_json" in resp.context


def test_habit_detail(authenticated_client):

    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())

    url = urls.reverse("habit:detail", kwargs={"uuid": habit.uuid})
    resp = client.get(url)

    assert resp.status_code == 200
    assert "habit_json" in resp.context


def test_get_habits_api(authenticated_client):

    user, client = authenticated_client()
    HabitFactory(user=user, start_date=date.today())

    url = urls.reverse("habit:get_habits")
    resp = client.get(url)

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["habits"]) == 1


def test_log_habit_create(authenticated_client):

    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())

    url = urls.reverse("habit:log")
    resp = client.post(url, {
        "habit_uuid": str(habit.uuid),
        "date": "2025-06-15",
        "completed": "true",
        "note": "Good day",
    })

    assert resp.status_code == 201
    data = resp.json()
    assert data["log"]["completed"] is True
    assert data["log"]["date"] == "2025-06-15"


def test_log_habit_update(authenticated_client):

    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())

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

    # Verify only one log for that date
    logs = HabitLog.objects.filter(habit=habit, date="2025-06-16")
    assert logs.count() == 1


def test_log_habit_missing_fields(authenticated_client):

    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())

    url = urls.reverse("habit:log")
    resp = client.post(url, {
        "habit_uuid": str(habit.uuid),
    })

    assert resp.status_code == 400


def test_log_habit_invalid_date(authenticated_client):

    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())

    url = urls.reverse("habit:log")
    resp = client.post(url, {
        "habit_uuid": str(habit.uuid),
        "date": "not-a-date",
        "completed": "true",
    })

    assert resp.status_code == 400


@pytest.mark.parametrize("bad_value", ["-1", "NaN", "Infinity", "-Infinity", "1e400"])
def test_log_habit_rejects_invalid_value(authenticated_client, bad_value):
    """Negative, non-finite, and out-of-range values are rejected with 400."""
    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())

    url = urls.reverse("habit:log")
    resp = client.post(url, {
        "habit_uuid": str(habit.uuid),
        "date": "2025-06-17",
        "completed": "true",
        "value": bad_value,
    })

    assert resp.status_code == 400
    assert not HabitLog.objects.filter(habit=habit, date="2025-06-17").exists()


def test_log_habit_accepts_valid_value(authenticated_client):
    """A normal non-negative value is stored."""
    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())

    url = urls.reverse("habit:log")
    resp = client.post(url, {
        "habit_uuid": str(habit.uuid),
        "date": "2025-06-18",
        "completed": "true",
        "value": "12.50",
    })

    assert resp.status_code == 201
    assert resp.json()["log"]["value"] == "12.50"


def test_create_habit_view_success(authenticated_client):
    """Creating a habit returns 201 with the synthesized dashboard payload."""
    user, client = authenticated_client()

    url = urls.reverse("habit:create")
    resp = client.post(url, {
        "name": "Floss",
        "start_date": "2025-06-01",
        "purpose": "Healthier gums",
    })

    assert resp.status_code == 201
    habit_data = resp.json()["habit"]
    assert habit_data["name"] == "Floss"
    assert habit_data["purpose"] == "Healthier gums"
    assert habit_data["is_active"] is True
    assert habit_data["total_logs"] == 0
    # The landing page renders a 7-day strip before any logs exist.
    assert len(habit_data["recent_logs"]) == 7
    assert all(entry["completed"] is False for entry in habit_data["recent_logs"])

    habit = Habit.objects.get(uuid=habit_data["uuid"])
    assert habit.user == user
    assert habit.name == "Floss"


def test_create_habit_view_invalid_date(authenticated_client):
    """A non-ISO start_date returns 400 and creates nothing."""
    user, client = authenticated_client()

    url = urls.reverse("habit:create")
    resp = client.post(url, {
        "name": "Floss",
        "start_date": "not-a-date",
    })

    assert resp.status_code == 400
    assert not Habit.objects.filter(user=user, name="Floss").exists()


def test_set_habit_inactive_success(authenticated_client):
    """Deactivating a habit sets an end_date and flips is_active off."""
    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today(), end_date=None)
    assert habit.is_active is True

    url = urls.reverse("habit:set_inactive")
    resp = client.post(url, {"habit_uuid": str(habit.uuid)})

    assert resp.status_code == 200
    data = resp.json()
    assert data["is_active"] is False
    assert data["end_date"] is not None

    habit.refresh_from_db()
    assert habit.end_date is not None
    assert habit.is_active is False


def test_set_habit_inactive_other_users_habit_returns_404(authenticated_client):
    """A user cannot deactivate another user's habit."""
    _, client = authenticated_client()
    other = UserFactory(username="otheruser")
    habit = HabitFactory(user=other, start_date=date.today(), end_date=None)

    url = urls.reverse("habit:set_inactive")
    resp = client.post(url, {"habit_uuid": str(habit.uuid)})

    assert resp.status_code == 404
    habit.refresh_from_db()
    assert habit.is_active is True


# -----------------------------------------------------------------------------
# Habit notes: many free-text observations per habit per day.
# -----------------------------------------------------------------------------


def test_note_add_creates_note(authenticated_client):

    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())

    url = urls.reverse("habit:note_add")
    resp = client.post(url, {
        "habit_uuid": str(habit.uuid),
        "date": "2025-06-15",
        "note": "Took it with breakfast",
    })

    assert resp.status_code == 201
    data = resp.json()
    assert data["note"]["note"] == "Took it with breakfast"
    assert data["note"]["date"] == "2025-06-15"
    assert HabitNote.objects.filter(habit=habit).count() == 1


def test_note_add_accumulates_within_a_day(authenticated_client):
    """Two posts for the same date leave two notes, not one."""
    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())

    url = urls.reverse("habit:note_add")
    for text in ("8am dose", "2pm headache"):
        client.post(url, {
            "habit_uuid": str(habit.uuid),
            "date": "2025-06-15",
            "note": text,
        })

    notes = HabitNote.objects.filter(habit=habit, date="2025-06-15")
    assert notes.count() == 2


@pytest.mark.parametrize("blank", ["", "   "])
def test_note_add_rejects_blank_note(authenticated_client, blank):

    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())

    url = urls.reverse("habit:note_add")
    resp = client.post(url, {
        "habit_uuid": str(habit.uuid),
        "date": "2025-06-15",
        "note": blank,
    })

    assert resp.status_code == 400
    assert not HabitNote.objects.filter(habit=habit).exists()


def test_note_add_invalid_date(authenticated_client):

    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())

    url = urls.reverse("habit:note_add")
    resp = client.post(url, {
        "habit_uuid": str(habit.uuid),
        "date": "not-a-date",
        "note": "Anything",
    })

    assert resp.status_code == 400
    assert not HabitNote.objects.filter(habit=habit).exists()


def test_note_add_other_users_habit_returns_404(authenticated_client):

    _, client = authenticated_client()
    other = UserFactory(username="otheruser")
    habit = HabitFactory(user=other, start_date=date.today())

    url = urls.reverse("habit:note_add")
    resp = client.post(url, {
        "habit_uuid": str(habit.uuid),
        "date": "2025-06-15",
        "note": "Not mine",
    })

    assert resp.status_code == 404
    assert not HabitNote.objects.filter(habit=habit).exists()


def test_note_update_changes_text(authenticated_client):

    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())
    note = HabitNote.objects.create(habit=habit, date=date.today(), note="typo")

    url = urls.reverse("habit:note_update")
    resp = client.post(url, {"note_uuid": str(note.uuid), "note": "fixed"})

    assert resp.status_code == 200
    assert resp.json()["note"]["note"] == "fixed"
    note.refresh_from_db()
    assert note.note == "fixed"


def test_note_update_rejects_blank_note(authenticated_client):
    """Blanking a note is a delete; the update endpoint refuses it."""
    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())
    note = HabitNote.objects.create(habit=habit, date=date.today(), note="keep me")

    url = urls.reverse("habit:note_update")
    resp = client.post(url, {"note_uuid": str(note.uuid), "note": "   "})

    assert resp.status_code == 400
    note.refresh_from_db()
    assert note.note == "keep me"


def test_note_update_other_users_note_returns_404(authenticated_client):

    _, client = authenticated_client()
    other = UserFactory(username="otheruser")
    habit = HabitFactory(user=other, start_date=date.today())
    note = HabitNote.objects.create(habit=habit, date=date.today(), note="theirs")

    url = urls.reverse("habit:note_update")
    resp = client.post(url, {"note_uuid": str(note.uuid), "note": "hijacked"})

    assert resp.status_code == 404
    note.refresh_from_db()
    assert note.note == "theirs"


def test_note_delete_removes_note(authenticated_client):

    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())
    note = HabitNote.objects.create(habit=habit, date=date.today(), note="oops")

    url = urls.reverse("habit:note_delete")
    resp = client.post(url, {"note_uuid": str(note.uuid)})

    assert resp.status_code == 200
    assert not HabitNote.objects.filter(pk=note.pk).exists()


def test_note_delete_other_users_note_returns_404(authenticated_client):

    _, client = authenticated_client()
    other = UserFactory(username="otheruser")
    habit = HabitFactory(user=other, start_date=date.today())
    note = HabitNote.objects.create(habit=habit, date=date.today(), note="theirs")

    url = urls.reverse("habit:note_delete")
    resp = client.post(url, {"note_uuid": str(note.uuid)})

    assert resp.status_code == 404
    assert HabitNote.objects.filter(pk=note.pk).exists()


def test_log_habit_note_appends_instead_of_overwriting(authenticated_client):
    """Saving the log panel twice keeps both notes; the second no longer wins."""
    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())

    url = urls.reverse("habit:log")
    for text in ("first thought", "second thought"):
        client.post(url, {
            "habit_uuid": str(habit.uuid),
            "date": "2025-06-20",
            "completed": "true",
            "note": text,
        })

    notes = HabitNote.objects.filter(habit=habit, date="2025-06-20")
    assert sorted(n.note for n in notes) == ["first thought", "second thought"]
    # Still exactly one log row for the day.
    assert HabitLog.objects.filter(habit=habit, date="2025-06-20").count() == 1


def test_log_habit_returns_the_note_it_created(authenticated_client):

    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())

    url = urls.reverse("habit:log")
    resp = client.post(url, {
        "habit_uuid": str(habit.uuid),
        "date": "2025-06-21",
        "completed": "true",
        "note": "Felt good",
    })

    assert resp.status_code == 201
    assert resp.json()["note"]["note"] == "Felt good"


def test_log_habit_blank_note_creates_nothing(authenticated_client):
    """Logging without filling the note box must not leave an empty note."""
    user, client = authenticated_client()
    habit = HabitFactory(user=user, start_date=date.today())

    url = urls.reverse("habit:log")
    resp = client.post(url, {
        "habit_uuid": str(habit.uuid),
        "date": "2025-06-22",
        "completed": "true",
        "note": "   ",
    })

    assert resp.status_code == 201
    assert resp.json()["note"] is None
    assert not HabitNote.objects.filter(habit=habit).exists()
