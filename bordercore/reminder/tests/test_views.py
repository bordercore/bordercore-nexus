"""Unit tests for reminder views."""

import pytest
from django.urls import reverse

from reminder.models import Reminder
from reminder.tests.factories import ReminderFactory

from accounts.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def reminder_client(client):
    """Logged-in client for reminder view tests (avoids duplicate username with other users)."""
    user = UserFactory(username="reminder_test_user", email="reminder_test@example.com")
    client.force_login(user)
    return user, client


def test_app_requires_login(client):
    """App view requires authentication; unauthenticated redirects to login."""
    url = reverse("reminder:app")
    resp = client.get(url)
    assert resp.status_code == 302
    assert resp.url.startswith("/accounts/login/")


def test_app_get_returns_200_and_context(reminder_client):
    """GET app URL returns 200 and context has title 'Reminders'."""
    _, client = reminder_client
    url = reverse("reminder:app")
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.context["title"] == "Reminders"


def test_list_ajax_requires_login(client):
    """List AJAX view requires authentication."""
    url = reverse("reminder:list-ajax")
    resp = client.get(url)
    assert resp.status_code == 302
    assert resp.url.startswith("/accounts/login/")


def test_list_ajax_returns_json_and_only_user_reminders(reminder_client):
    """GET list-ajax returns 200, JSON with reminders and pagination; only current user's."""
    user, client = reminder_client
    ReminderFactory(user=user, name="Mine")
    other_user = UserFactory(username="other_reminder_user", email="other@example.com")
    ReminderFactory(user=other_user, name="Other")
    url = reverse("reminder:list-ajax")
    resp = client.get(url)
    assert resp.status_code == 200
    data = resp.json()
    assert "reminders" in data
    assert "pagination" in data
    assert len(data["reminders"]) == 1
    assert data["reminders"][0]["name"] == "Mine"


def test_detail_requires_login(client):
    """Detail view requires authentication."""
    reminder = ReminderFactory(name="Test")
    url = reverse("reminder:detail", kwargs={"uuid": reminder.uuid})
    resp = client.get(url)
    assert resp.status_code == 302
    assert resp.url.startswith("/accounts/login/")


def test_detail_returns_200_and_context(reminder_client):
    """GET detail by uuid returns 200, context has reminder and detail_ajax_url."""
    user, client = reminder_client
    reminder = ReminderFactory(user=user, name="My Reminder")
    url = reverse("reminder:detail", kwargs={"uuid": reminder.uuid})
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.context["reminder"] == reminder
    assert "detail_ajax_url" in resp.context
    assert str(reminder.uuid) in resp.context["detail_ajax_url"]


def test_detail_other_user_returns_404(reminder_client):
    """GET detail for another user's reminder returns 404."""
    _, client = reminder_client
    other_user = UserFactory(username="other_reminder_user", email="other@example.com")
    reminder = ReminderFactory(user=other_user)
    url = reverse("reminder:detail", kwargs={"uuid": reminder.uuid})
    resp = client.get(url)
    assert resp.status_code == 404


def test_detail_ajax_requires_login(client):
    """Detail AJAX view requires authentication."""
    reminder = ReminderFactory()
    url = reverse("reminder:detail-ajax", kwargs={"uuid": reminder.uuid})
    resp = client.get(url)
    assert resp.status_code == 302
    assert resp.url.startswith("/accounts/login/")


def test_detail_ajax_returns_json_with_expected_fields(reminder_client):
    """GET detail-ajax returns JSON with uuid, name, schedule_description, etc."""
    user, client = reminder_client
    reminder = ReminderFactory(user=user, name="Ajax Reminder")
    url = reverse("reminder:detail-ajax", kwargs={"uuid": reminder.uuid})
    resp = client.get(url)
    assert resp.status_code == 200
    data = resp.json()
    assert data["uuid"] == str(reminder.uuid)
    assert data["name"] == "Ajax Reminder"
    assert "schedule_description" in data
    assert "schedule_type" in data
    assert "next_trigger_at" in data
    assert "update_url" in data
    assert "delete_url" in data


def test_detail_ajax_other_user_returns_404(reminder_client):
    """GET detail-ajax for another user's reminder returns 404."""
    _, client = reminder_client
    other_user = UserFactory(username="other_reminder_user", email="other@example.com")
    reminder = ReminderFactory(user=other_user)
    url = reverse("reminder:detail-ajax", kwargs={"uuid": reminder.uuid})
    resp = client.get(url)
    assert resp.status_code == 404


def test_form_ajax_requires_login(client):
    """Form AJAX view requires authentication."""
    reminder = ReminderFactory()
    url = reverse("reminder:form-ajax", kwargs={"uuid": reminder.uuid})
    resp = client.get(url)
    assert resp.status_code == 302
    assert resp.url.startswith("/accounts/login/")


def test_form_ajax_returns_json_with_form_fields(reminder_client):
    """GET form-ajax returns JSON with name, schedule_type, trigger_time, days_of_week, etc."""
    user, client = reminder_client
    reminder = ReminderFactory(user=user, name="Edit Me")
    url = reverse("reminder:form-ajax", kwargs={"uuid": reminder.uuid})
    resp = client.get(url)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Edit Me"
    assert "schedule_type" in data
    assert "trigger_time" in data
    assert "days_of_week" in data
    assert "days_of_month" in data


def test_form_ajax_other_user_returns_404(reminder_client):
    """GET form-ajax for another user's reminder returns 404."""
    _, client = reminder_client
    other_user = UserFactory(username="other_reminder_user", email="other@example.com")
    reminder = ReminderFactory(user=other_user)
    url = reverse("reminder:form-ajax", kwargs={"uuid": reminder.uuid})
    resp = client.get(url)
    assert resp.status_code == 404


def test_create_get_requires_login(client):
    """Create view GET requires authentication."""
    url = reverse("reminder:create")
    resp = client.get(url)
    assert resp.status_code == 302
    assert resp.url.startswith("/accounts/login/")


def test_create_get_returns_200(reminder_client):
    """GET create returns 200."""
    _, client = reminder_client
    url = reverse("reminder:create")
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.context["title"] == "New Reminder"
    assert resp.context["is_edit"] is False


def test_create_post_valid_creates_reminder(reminder_client):
    """POST valid data to create creates reminder with user and next_trigger_at."""
    user, client = reminder_client
    url = reverse("reminder:create")
    data = {
        "name": "New Reminder",
        "schedule_type": Reminder.SCHEDULE_TYPE_DAILY,
        "trigger_time": "09:00",
    }
    resp = client.post(url, data)
    assert resp.status_code == 302
    assert resp.url == reverse("reminder:app")
    assert Reminder.objects.filter(user=user, name="New Reminder").exists()
    reminder = Reminder.objects.get(user=user, name="New Reminder")
    assert reminder.next_trigger_at is not None


def test_create_post_invalid_returns_errors(reminder_client):
    """POST invalid data (e.g. empty name) returns form errors."""
    _, client = reminder_client
    url = reverse("reminder:create")
    data = {
        "name": "",
        "schedule_type": Reminder.SCHEDULE_TYPE_DAILY,
        "trigger_time": "09:00",
    }
    resp = client.post(url, data)
    assert resp.status_code == 200
    assert "name" in resp.context["form"].errors


def test_create_post_ajax_returns_json_success(reminder_client):
    """POST create with X-Requested-With: XMLHttpRequest returns JSON success."""
    _, client = reminder_client
    url = reverse("reminder:create")
    data = {
        "name": "AJAX Reminder",
        "schedule_type": Reminder.SCHEDULE_TYPE_DAILY,
        "trigger_time": "09:00",
    }
    resp = client.post(url, data, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
    assert resp.status_code == 200
    json_data = resp.json()
    assert json_data["success"] is True
    assert "redirect_url" in json_data


def test_update_requires_login(client):
    """Update view requires authentication."""
    reminder = ReminderFactory()
    url = reverse("reminder:update", kwargs={"uuid": reminder.uuid})
    resp = client.get(url)
    assert resp.status_code == 302
    assert resp.url.startswith("/accounts/login/")


def test_update_other_user_returns_404(reminder_client):
    """GET/POST update for another user's reminder returns 404."""
    _, client = reminder_client
    other_user = UserFactory(username="other_reminder_user", email="other@example.com")
    reminder = ReminderFactory(user=other_user, name="Other")
    url = reverse("reminder:update", kwargs={"uuid": reminder.uuid})
    resp = client.get(url)
    assert resp.status_code == 404
    resp = client.post(url, {"name": "Hacked", "schedule_type": "daily", "trigger_time": "09:00"})
    assert resp.status_code == 404


def test_update_post_valid_updates_and_recalculates(reminder_client):
    """POST valid data to update updates reminder and recalculates next_trigger_at."""
    user, client = reminder_client
    reminder = ReminderFactory(user=user, name="Original")
    url = reverse("reminder:update", kwargs={"uuid": reminder.uuid})
    data = {
        "name": "Updated Name",
        "schedule_type": Reminder.SCHEDULE_TYPE_DAILY,
        "trigger_time": "10:00",
    }
    resp = client.post(url, data)
    assert resp.status_code == 302
    reminder.refresh_from_db()
    assert reminder.name == "Updated Name"
    assert reminder.next_trigger_at is not None


def test_update_post_invalid_returns_errors(reminder_client):
    """POST invalid data to update returns form errors."""
    user, client = reminder_client
    reminder = ReminderFactory(user=user)
    url = reverse("reminder:update", kwargs={"uuid": reminder.uuid})
    data = {
        "name": "",
        "schedule_type": Reminder.SCHEDULE_TYPE_DAILY,
        "trigger_time": "09:00",
    }
    resp = client.post(url, data)
    assert resp.status_code == 200
    assert "name" in resp.context["form"].errors


def test_update_post_ajax_returns_json_success(reminder_client):
    """POST update with X-Requested-With: XMLHttpRequest returns JSON success."""
    user, client = reminder_client
    reminder = ReminderFactory(user=user, name="To Update")
    url = reverse("reminder:update", kwargs={"uuid": reminder.uuid})
    data = {
        "name": "Updated via AJAX",
        "schedule_type": Reminder.SCHEDULE_TYPE_DAILY,
        "trigger_time": "09:00",
    }
    resp = client.post(url, data, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
    assert resp.status_code == 200
    json_data = resp.json()
    assert json_data["success"] is True
    assert "redirect_url" in json_data


def test_delete_requires_login(client):
    """Delete view requires authentication."""
    reminder = ReminderFactory()
    url = reverse("reminder:delete", kwargs={"uuid": reminder.uuid})
    resp = client.post(url)
    assert resp.status_code == 302
    assert resp.url.startswith("/accounts/login/")


def test_delete_other_user_returns_404(reminder_client):
    """POST delete for another user's reminder returns 404."""
    _, client = reminder_client
    other_user = UserFactory(username="other_reminder_user", email="other@example.com")
    reminder = ReminderFactory(user=other_user)
    url = reverse("reminder:delete", kwargs={"uuid": reminder.uuid})
    resp = client.post(url)
    assert resp.status_code == 404
    assert Reminder.objects.filter(uuid=reminder.uuid).exists()


def test_delete_post_removes_reminder(reminder_client):
    """POST delete removes reminder and redirects to app."""
    user, client = reminder_client
    reminder = ReminderFactory(user=user, name="To Delete")
    url = reverse("reminder:delete", kwargs={"uuid": reminder.uuid})
    resp = client.post(url)
    assert resp.status_code == 302
    assert resp.url == reverse("reminder:app")
    assert not Reminder.objects.filter(uuid=reminder.uuid).exists()
