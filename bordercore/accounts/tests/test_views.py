import pytest

from django import urls

from accounts.tests.factories import TEST_USERNAME, TEST_PASSWORD

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
    assert resp.status_code == 200
    assert resp.json()["status"] == "OK"


def test_pin_note_already_pinned(auto_login_user, blob_text_factory):
    _, client = auto_login_user()
    url = urls.reverse("accounts:pin_note")
    # blob_text_factory[0] is already pinned by the auto_login_user fixture
    resp = client.post(url, {"uuid": blob_text_factory[0].uuid})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ERROR"
    assert "already pinned" in resp.json()["message"]


def test_unpin_note(auto_login_user, blob_text_factory):
    _, client = auto_login_user()
    url = urls.reverse("accounts:pin_note")
    resp = client.post(url, {
        "uuid": blob_text_factory[0].uuid,
        "remove": "true"
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "OK"


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
