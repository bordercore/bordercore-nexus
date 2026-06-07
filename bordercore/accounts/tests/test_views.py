import json
from datetime import timedelta

import pytest

from django import urls
from django.contrib.sessions.models import Session
from django.utils import timezone

from accounts.models import UserSession
from accounts.tests.factories import TEST_PASSWORD, TEST_USERNAME, UserFactory

pytestmark = [pytest.mark.django_db]


# ── Preferences ──────────────────────────────────────────────────────────


def test_prefs_get(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:prefs")
    resp = client.get(url)
    assert resp.status_code == 200


def test_prefs_post(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:prefs")
    resp = client.post(url, {
        "pinned_tags": "django",
        "google_calendar": "",
        "theme": "dark"
    })
    assert resp.status_code == 200


# ── Password ─────────────────────────────────────────────────────────────


def test_password_get(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:password")
    resp = client.get(url)
    assert resp.status_code == 200


def test_password_change_success(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:password")
    resp = client.post(url, {
        "old_password": TEST_PASSWORD,
        "new_password1": "New Password",
        "new_password2": "New Password"
    })
    assert resp.status_code == 302


def test_password_change_wrong_old_password(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:password")
    resp = client.post(url, {
        "old_password": "wrongpassword",
        "new_password1": "New Password",
        "new_password2": "New Password"
    })
    assert resp.status_code == 200


def test_password_change_mismatched_new_passwords(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:password")
    resp = client.post(url, {
        "old_password": TEST_PASSWORD,
        "new_password1": "New Password",
        "new_password2": "Different Password"
    })
    assert resp.status_code == 200


# ── Sort pinned notes ────────────────────────────────────────────────────


def test_sort_pinned_notes(auto_login_user, blob_text_factory):
    _, client = auto_login_user()
    url = urls.reverse("accounts:sort_pinned_notes")
    resp = client.post(url, {
        "note_uuid": blob_text_factory[0].uuid,
        "new_position": "1"
    })
    assert resp.status_code == 200


def test_sort_pinned_notes_invalid_position(auto_login_user, blob_text_factory):
    _, client = auto_login_user()
    url = urls.reverse("accounts:sort_pinned_notes")
    resp = client.post(url, {
        "note_uuid": blob_text_factory[0].uuid,
        "new_position": "0"
    })
    assert resp.status_code == 400


# ── Pin / unpin notes ────────────────────────────────────────────────────


def test_pin_note(authenticated_client, blob_image_factory):
    _, client = authenticated_client()
    url = urls.reverse("accounts:pin_note")
    resp = client.post(url, {"uuid": blob_image_factory[0].uuid})
    assert resp.status_code == 201


def test_pin_note_already_pinned(auto_login_user, blob_text_factory):
    _, client = auto_login_user()
    url = urls.reverse("accounts:pin_note")
    # blob_text_factory[0] is already pinned by the auto_login_user fixture
    resp = client.post(url, {"uuid": blob_text_factory[0].uuid})
    assert resp.status_code == 409
    assert "already pinned" in resp.json()["detail"]


def test_unpin_note(auto_login_user, blob_text_factory):
    _, client = auto_login_user()
    url = urls.reverse("accounts:pin_note")
    resp = client.post(url, {
        "uuid": blob_text_factory[0].uuid,
        "remove": "true"
    })
    assert resp.status_code == 204


def test_pin_note_remove_false_pins(authenticated_client, blob_image_factory):
    # A falsey-looking string must not be treated as truthy and trigger an unpin.
    _, client = authenticated_client()
    url = urls.reverse("accounts:pin_note")
    resp = client.post(url, {
        "uuid": blob_image_factory[0].uuid,
        "remove": "false"
    })
    assert resp.status_code == 201


# ── Store in session ─────────────────────────────────────────────────────


def test_store_in_session_allowed_key(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:store_in_session")
    resp = client.post(url, {"todo_sort": '{"field":"sort_order","direction":"asc"}'})
    assert resp.status_code == 200
    assert client.session["todo_sort"] == '{"field":"sort_order","direction":"asc"}'


def test_store_in_session_rejects_disallowed_key(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:store_in_session")
    resp = client.post(url, {"evil_key": "malicious_value"})
    assert resp.status_code == 200
    assert "evil_key" not in client.session


# ── Login ────────────────────────────────────────────────────────────────


def test_login_success(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:login")
    resp = client.post(url, {
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD,
    })
    assert resp.status_code == 302


def test_login_invalid_password(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:login")
    resp = client.post(url, {
        "username": TEST_USERNAME,
        "password": "wrongpassword",
    })
    assert resp.status_code == 200
    assert "Invalid username or password" in resp.content.decode()


def test_login_nonexistent_user(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:login")
    resp = client.post(url, {
        "username": "nonexistent_user",
        "password": "whatever",
    })
    assert resp.status_code == 200
    # Should show the same generic message, not "Username does not exist"
    assert "Invalid username or password" in resp.content.decode()
    assert "does not exist" not in resp.content.decode()


def test_login_rejects_open_redirect(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:login")
    resp = client.post(url, {
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD,
        "next": "https://evil.com",
    })
    assert resp.status_code == 302
    # Should redirect to homepage, not to evil.com
    assert "evil.com" not in resp.url


def test_login_valid_next_redirect(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:login")
    next_url = urls.reverse("accounts:prefs")
    resp = client.post(url, {
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD,
        "next": next_url,
    })
    assert resp.status_code == 302
    assert resp.url == next_url


# ── Logout ───────────────────────────────────────────────────────────────


def test_logout(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:logout")
    resp = client.get(url)
    assert resp.status_code == 302


# ── Weather ──────────────────────────────────────────────────────────────


def test_get_weather(authenticated_client):
    user, client = authenticated_client()
    url = urls.reverse("accounts:get_weather")
    resp = client.get(url)
    assert resp.status_code == 200
    assert "weather" in resp.json()


def test_get_weather_with_data(authenticated_client):
    user, client = authenticated_client()
    weather_data = {"location": {"name": "Cambridge"}, "current": {"temp_f": 72}}
    user.userprofile.weather = weather_data
    user.userprofile.save()

    url = urls.reverse("accounts:get_weather")
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.json()["weather"]["location"]["name"] == "Cambridge"


# ── Instagram credentials (managed in form_valid) ────────────────────────


def _valid_prefs_post(**overrides):
    """A complete, valid UserProfileForm payload (mirrors the React prefs page)."""
    data = {
        "theme": "light",
        "topbar_animation": "aurora",
        "visualizer": "torus",
        "eye_candy": "false",
        "drill_intervals": "1,3,7,14",
        "drill_tags_muted": "",
        "nytimes_api_key": "",
        "weather_location": "02138",
        "google_calendar": "",
        "google_calendar_email": "",
        "bookmarks_per_page": "50",
        "background_image": "",
        "sidebar_image": "",
    }
    data.update(overrides)
    return data


def test_prefs_sets_instagram_credentials(authenticated_client):
    user, client = authenticated_client()
    url = urls.reverse("accounts:prefs")
    resp = client.post(
        url,
        _valid_prefs_post(instagram_username="iguser", instagram_password="igpass"),
        HTTP_X_REQUESTED_WITH="XMLHttpRequest",
    )
    assert resp.status_code == 200
    user.userprofile.refresh_from_db()
    assert user.userprofile.instagram_credentials == {
        "username": "iguser",
        "password": "igpass",
    }


def test_prefs_clears_instagram_credentials_when_blank(authenticated_client):
    user, client = authenticated_client()
    user.userprofile.instagram_credentials = {"username": "old", "password": "old"}
    user.userprofile.save()

    url = urls.reverse("accounts:prefs")
    resp = client.post(
        url,
        _valid_prefs_post(instagram_username="", instagram_password=""),
        HTTP_X_REQUESTED_WITH="XMLHttpRequest",
    )
    assert resp.status_code == 200
    user.userprofile.refresh_from_db()
    assert user.userprofile.instagram_credentials is None


def test_prefs_sets_weather_location(authenticated_client):
    user, client = authenticated_client()
    url = urls.reverse("accounts:prefs")
    resp = client.post(
        url,
        _valid_prefs_post(weather_location="90210"),
        HTTP_X_REQUESTED_WITH="XMLHttpRequest",
    )
    assert resp.status_code == 200
    user.userprofile.refresh_from_db()
    assert user.userprofile.weather_location == "90210"


# ── update_sidebar_order ─────────────────────────────────────────────────


def test_update_sidebar_order_valid(authenticated_client):
    user, client = authenticated_client()
    url = urls.reverse("accounts:update_sidebar_order")
    resp = client.post(url, {"order": json.dumps(["/a", "/b"])})
    assert resp.status_code == 200
    user.userprofile.refresh_from_db()
    assert user.userprofile.sidebar_order == ["/a", "/b"]


def test_update_sidebar_order_rejects_non_json(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:update_sidebar_order")
    resp = client.post(url, {"order": "not valid json"})
    assert resp.status_code == 400


def test_update_sidebar_order_rejects_non_list(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:update_sidebar_order")
    resp = client.post(url, {"order": json.dumps({"not": "a list"})})
    assert resp.status_code == 400


def test_update_sidebar_order_rejects_non_string_items(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:update_sidebar_order")
    resp = client.post(url, {"order": json.dumps(["/a", 7])})
    assert resp.status_code == 400


def test_update_sidebar_order_rejects_over_limit(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("accounts:update_sidebar_order")
    too_many = [f"/{i}" for i in range(101)]
    resp = client.post(url, {"order": json.dumps(too_many)})
    assert resp.status_code == 400


# ── list_sessions / revoke_session ───────────────────────────────────────


def test_list_sessions_excludes_sessions_with_no_live_django_session(authenticated_client):
    """A UserSession whose Django Session has expired/been deleted is omitted."""
    user, client = authenticated_client()

    live = Session.objects.create(
        session_key="livesessionkey0001",
        session_data="",
        expire_date=timezone.now() + timedelta(days=1),
    )
    live_us = UserSession.objects.create(
        user=user, session_key=live.session_key, user_agent="Mozilla/5.0"
    )
    dead_us = UserSession.objects.create(
        user=user, session_key="deadsessionkey0001", user_agent="Mozilla/5.0"
    )

    url = urls.reverse("accounts:list_sessions")
    resp = client.get(url)
    assert resp.status_code == 200

    returned = {item["uuid"] for item in resp.json()}
    assert str(live_us.uuid) in returned
    assert str(dead_us.uuid) not in returned


def test_revoke_session_other_user_returns_404(authenticated_client):
    user, client = authenticated_client()
    other = UserFactory(username="otheruser")
    other_session = UserSession.objects.create(
        user=other, session_key="otheruserkey0001", user_agent="x"
    )

    url = urls.reverse("accounts:revoke_session", kwargs={"session_uuid": other_session.uuid})
    resp = client.post(url)
    assert resp.status_code == 404
    assert UserSession.objects.filter(pk=other_session.pk).exists()


def test_revoke_session_current_session_returns_400(authenticated_client):
    user, client = authenticated_client()
    current_key = client.session.session_key
    # The session-tracking middleware may already have registered the current
    # session, so get_or_create rather than create.
    current_us, _ = UserSession.objects.get_or_create(
        user=user, session_key=current_key, defaults={"user_agent": "x"}
    )

    url = urls.reverse("accounts:revoke_session", kwargs={"session_uuid": current_us.uuid})
    resp = client.post(url)
    assert resp.status_code == 400
    assert UserSession.objects.filter(pk=current_us.pk).exists()


def test_revoke_session_deletes_session_and_row(authenticated_client):
    user, client = authenticated_client()
    target = Session.objects.create(
        session_key="targetsessionkey01",
        session_data="",
        expire_date=timezone.now() + timedelta(days=1),
    )
    target_us = UserSession.objects.create(
        user=user, session_key=target.session_key, user_agent="x"
    )

    url = urls.reverse("accounts:revoke_session", kwargs={"session_uuid": target_us.uuid})
    resp = client.post(url)
    assert resp.status_code == 204
    assert not UserSession.objects.filter(pk=target_us.pk).exists()
    assert not Session.objects.filter(session_key=target.session_key).exists()
