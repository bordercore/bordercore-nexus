import pytest

from django import urls

pytestmark = [pytest.mark.django_db]


def test_accounts_prefs(authenticated_client):

    _, client = authenticated_client()

    # The empty form
    url = urls.reverse("accounts:prefs")
    resp = client.get(url)

    assert resp.status_code == 200

    # The submitted form
    url = urls.reverse("accounts:prefs")
    resp = client.post(url, {
        "pinned_tags": "django",
        "google_calendar": "",
        "theme": "dark"
    })

    assert resp.status_code == 200


def test_accounts_password(authenticated_client):

    _, client = authenticated_client()

    # The empty form
    url = urls.reverse("accounts:password")
    resp = client.get(url)

    assert resp.status_code == 200

    # The submitted form
    url = urls.reverse("accounts:password")
    resp = client.post(url, {
        "old_password": "testpassword",
        "new_password1": "New Password",
        "new_password2": "New Password"
    })

    assert resp.status_code == 302


def test_accounts_sort_pinned_notes(auto_login_user, blob_text_factory):

    user, client = auto_login_user()

    url = urls.reverse("accounts:sort_pinned_notes")
    resp = client.post(url, {
        "note_uuid": blob_text_factory[0].uuid,
        "new_position": "1"
    })

    assert resp.status_code == 200


def test_accounts_pin_note(authenticated_client, blob_image_factory):

    _, client = authenticated_client()

    url = urls.reverse("accounts:pin_note")
    resp = client.post(url, {
        "uuid": blob_image_factory[0].uuid
    })

    assert resp.status_code == 200


def test_accounts_unpin_note(auto_login_user, blob_text_factory):

    _, client = auto_login_user()

    url = urls.reverse("accounts:pin_note")
    resp = client.post(url, {
        "uuid": blob_text_factory[0].uuid,
        "remove": "true"
    })

    assert resp.status_code == 200


def test_accounts_store_in_session(authenticated_client):

    _, client = authenticated_client()

    url = urls.reverse("accounts:store_in_session")
    resp = client.post(url, {
        "key": "value"
    })

    assert resp.status_code == 200


def test_accounts_login(authenticated_client):

    _, client = authenticated_client()

    url = urls.reverse("accounts:login")
    resp = client.post(url, {
        "username": "testuser",
        "password": "testpassword",
    })

    assert resp.status_code == 302


def test_accounts_logout(authenticated_client):

    _, client = authenticated_client()

    url = urls.reverse("accounts:logout")
    resp = client.get(url)

    assert resp.status_code == 302
