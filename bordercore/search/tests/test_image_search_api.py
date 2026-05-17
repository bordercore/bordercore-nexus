"""Tests for the image_search_results API endpoint."""

from __future__ import annotations

import io
import uuid
from unittest.mock import patch

import pytest

from django import urls

pytestmark = [pytest.mark.django_db]

_EMPTY_RESPONSE = {
    "results": [],
    "aggregations": [],
    "paginator": {},
    "count": 0,
}

_RESULT_RESPONSE = {
    "results": [
        {
            "source": {
                "uuid": str(uuid.uuid4()),
                "doctype": "blob",
                "name": "sunset.jpg",
                "tags": [],
                "importance": 1,
                "last_modified": "2 days ago",
                "url": "/blob/some-uuid/",
            },
            "score": 0.92,
            "tags_json": "[]",
        }
    ],
    "aggregations": [],
    "paginator": {"page_number": 1, "num_pages": 1},
    "count": 1,
}


def _image_url():
    return urls.reverse("search:image_search_results_api")


# ---------------------------------------------------------------------------
# Method guard
# ---------------------------------------------------------------------------


def test_get_returns_405(authenticated_client):
    _, client = authenticated_client()
    resp = client.get(_image_url())
    assert resp.status_code == 405


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------


def test_requires_auth(client):
    resp = client.post(_image_url(), data={})
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 400 when no payload
# ---------------------------------------------------------------------------


def test_post_with_neither_returns_400(authenticated_client):
    _, client = authenticated_client()
    resp = client.post(_image_url(), data={})
    assert resp.status_code == 400
    assert "detail" in resp.json()


# ---------------------------------------------------------------------------
# POST with text
# ---------------------------------------------------------------------------


@patch("search.api.perform_image_search")
def test_post_with_text_returns_search_response(mock_perform, authenticated_client):
    _, client = authenticated_client()
    mock_perform.return_value = _RESULT_RESPONSE

    resp = client.post(_image_url(), data={"text": "a dog on the beach"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 1
    assert len(data["results"]) == 1
    assert "aggregations" in data
    assert "paginator" in data

    mock_perform.assert_called_once()
    _, kwargs = mock_perform.call_args
    assert kwargs["text"] == "a dog on the beach"
    assert kwargs["image_bytes"] is None


# ---------------------------------------------------------------------------
# POST with image file
# ---------------------------------------------------------------------------


@patch("search.api.perform_image_search")
def test_post_with_image_passes_bytes_to_service(mock_perform, authenticated_client):
    _, client = authenticated_client()
    mock_perform.return_value = _EMPTY_RESPONSE

    fake_image = io.BytesIO(b"\xff\xd8\xff\xe0fake-jpeg-bytes")
    fake_image.name = "test.jpg"

    resp = client.post(
        _image_url(),
        data={"image": fake_image},
        format="multipart",
    )

    assert resp.status_code == 200
    mock_perform.assert_called_once()
    _, kwargs = mock_perform.call_args
    assert kwargs["image_bytes"] == b"\xff\xd8\xff\xe0fake-jpeg-bytes"
    assert kwargs["text"] is None


# ---------------------------------------------------------------------------
# Service error handling
# ---------------------------------------------------------------------------


@patch("search.api.perform_image_search", side_effect=ValueError("bad input"))
def test_value_error_returns_400(mock_perform, authenticated_client):
    _, client = authenticated_client()
    resp = client.post(_image_url(), data={"text": "something"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "bad input"


@patch("search.api.perform_image_search", side_effect=RuntimeError("lambda down"))
def test_runtime_error_returns_502(mock_perform, authenticated_client):
    _, client = authenticated_client()
    resp = client.post(_image_url(), data={"text": "something"})
    assert resp.status_code == 502
    assert resp.json()["detail"] == "lambda down"
