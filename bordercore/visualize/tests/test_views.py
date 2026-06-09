"""
Smoke tests for the Constellation page and graph API endpoint.
"""
from __future__ import annotations

import pytest

from django import urls
from django.test import override_settings

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
    assert set(body) == {"nodes", "edges", "community_labels"}
    assert isinstance(body["nodes"], list)
    assert isinstance(body["edges"], list)
    assert isinstance(body["community_labels"], dict)


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


def test_graph_api_empty_layers_falls_back_to_direct_and_tags(authenticated_client):
    """A layers param with no valid tokens falls back to {direct, tags}."""
    from unittest.mock import patch

    from visualize.services import DEFAULT_TOP_K

    user, client = authenticated_client()
    url = urls.reverse("visualize:graph_api")

    with patch("visualize.views.cache") as mock_cache:
        mock_cache.get.return_value = None
        resp = client.get(url, {"layers": "bogus,nonsense"})

    assert resp.status_code == 200
    expected_key = f"viz:graph:{user.pk}:{DEFAULT_TOP_K}:direct,tags"
    assert mock_cache.get.call_args.args[0] == expected_key


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
)
def test_graph_api_caches_payload_for_repeat_request(authenticated_client):
    """A second GET by the same user serves the cached payload (build_graph runs once)."""
    from unittest.mock import patch

    from django.core.cache import cache

    _, client = authenticated_client()
    cache.clear()
    url = urls.reverse("visualize:graph_api")

    payload = {"nodes": [], "edges": [], "community_labels": {}}
    with patch("visualize.views.build_graph", return_value=payload) as mock_build:
        client.get(url, {"layers": "direct,tags"})
        client.get(url, {"layers": "direct,tags"})

    mock_build.assert_called_once()


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
)
def test_graph_api_does_not_share_cache_across_users(authenticated_client):
    """Two users must never receive each other's cached graph payload."""
    from unittest.mock import patch

    from django.core.cache import cache
    from django.test import Client

    from accounts.tests.factories import UserFactory

    cache.clear()
    user_a, client_a = authenticated_client()

    user_b = UserFactory(username="otheruser")
    client_b = Client()
    client_b.force_login(user_b)

    url = urls.reverse("visualize:graph_api")
    payload_a = {"nodes": [{"id": "A"}], "edges": [], "community_labels": {}}
    payload_b = {"nodes": [{"id": "B"}], "edges": [], "community_labels": {}}

    def fake_build(user, layers, top_k):
        return payload_a if user.pk == user_a.pk else payload_b

    with patch("visualize.views.build_graph", side_effect=fake_build):
        resp_a = client_a.get(url, {"layers": "direct,tags"})
        resp_b = client_b.get(url, {"layers": "direct,tags"})

    assert resp_a.json()["nodes"] == [{"id": "A"}]
    assert resp_b.json()["nodes"] == [{"id": "B"}]


def test_graph_api_cache_key_includes_top_k(authenticated_client):
    """The cache key must include top_k so a future non-default top_k can't
    collide with the default on the same user/layers."""
    from unittest.mock import patch

    from visualize.services import DEFAULT_TOP_K

    user, client = authenticated_client()
    url = urls.reverse("visualize:graph_api")

    with patch("visualize.views.cache") as mock_cache:
        mock_cache.get.return_value = None
        resp = client.get(url, {"layers": "direct,tags"})

    assert resp.status_code == 200

    expected_key = f"viz:graph:{user.pk}:{DEFAULT_TOP_K}:direct,tags"
    assert mock_cache.get.call_args.args[0] == expected_key
    mock_cache.set.assert_called_once()
    assert mock_cache.set.call_args.args[0] == expected_key
