"""
Smoke tests for the Constellation page and graph API endpoint.
"""
from __future__ import annotations

import pytest

from django import urls

pytestmark = [pytest.mark.django_db]


def test_constellation_page_requires_login(client):
    url = urls.reverse("visualize:constellation")
    resp = client.get(url)
    assert resp.status_code == 302  # redirect to login


def test_constellation_page_ok_for_authed_user(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("visualize:constellation")
    resp = client.get(url)
    assert resp.status_code == 200


def test_graph_api_requires_auth(client):
    url = urls.reverse("visualize:graph_api")
    resp = client.get(url)
    assert resp.status_code in (401, 403)


def test_graph_api_returns_expected_shape(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("visualize:graph_api")

    resp = client.get(url)

    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {"nodes", "edges"}
    assert isinstance(body["nodes"], list)
    assert isinstance(body["edges"], list)


def test_graph_api_accepts_layers_param(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("visualize:graph_api")

    resp = client.get(url, {"layers": "direct,tags,collections"})

    assert resp.status_code == 200


def test_graph_api_ignores_unknown_layer_tokens(authenticated_client):
    _, client = authenticated_client()
    url = urls.reverse("visualize:graph_api")

    resp = client.get(url, {"layers": "direct,bogus"})

    assert resp.status_code == 200
