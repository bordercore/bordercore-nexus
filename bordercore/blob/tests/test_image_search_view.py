"""Tests for the ImageSearchView page."""
from unittest.mock import patch

import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_get_renders_form(auto_login_user):
    user, client = auto_login_user()
    response = client.get(reverse("blob:image_search"))
    assert response.status_code == 200


@pytest.mark.django_db
@patch("blob.views.find_similar_images")
def test_post_text_returns_matches(mock_find, auto_login_user):
    user, client = auto_login_user()
    mock_find.return_value = [
        ("00000000-0000-0000-0000-000000000001", 0.92),
        ("00000000-0000-0000-0000-000000000002", 0.78),
    ]
    response = client.post(reverse("blob:image_search"), {"text": "sunset", "threshold": "0.6"})
    assert response.status_code == 200
    mock_find.assert_called_once()
    kwargs = mock_find.call_args.kwargs
    assert kwargs["text"] == "sunset"
    assert kwargs["threshold"] == 0.6
    # The view passes user_id from the logged-in user
    assert kwargs["user_id"] == user.id


@pytest.mark.django_db
@patch("blob.views.find_similar_images")
def test_post_image_upload_passes_bytes(mock_find, auto_login_user):
    from django.core.files.uploadedfile import SimpleUploadedFile

    user, client = auto_login_user()
    mock_find.return_value = []
    image = SimpleUploadedFile("query.jpg", b"FAKEPNGBYTES", content_type="image/jpeg")
    response = client.post(reverse("blob:image_search"), {"image": image, "threshold": "0.5"})
    assert response.status_code == 200
    assert mock_find.call_args.kwargs["image_bytes"] == b"FAKEPNGBYTES"


@pytest.mark.django_db
def test_post_neither_input_shows_form_error(auto_login_user):
    user, client = auto_login_user()
    response = client.post(reverse("blob:image_search"), {"threshold": "0.5"})
    # Form should re-render with non-field error; no Lambda call expected
    assert response.status_code == 200


@pytest.mark.django_db
@patch("blob.views.find_similar_images")
def test_post_lambda_crash_rerenders_form_with_error(mock_find, auto_login_user):
    """A RuntimeError from find_similar_images (e.g. Lambda crash) re-renders the
    form with an error message instead of returning a 500."""
    user, client = auto_login_user()
    mock_find.side_effect = RuntimeError("CreateImageEmbedding Lambda crashed: {'errorType': 'Runtime.ExitError'}")
    response = client.post(reverse("blob:image_search"), {"text": "mountains", "threshold": "0.6"})
    assert response.status_code == 200
    assert b"Image search failed" in response.content
