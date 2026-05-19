"""Tests for the failed-count JSON API used by the live topbar pill."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory


@pytest.mark.django_db
def test_failed_count_api_returns_count():
    user = UserFactory()
    client = APIClient()
    client.force_authenticate(user=user)

    url = reverse("metrics:failed_count_api")
    response = client.get(url)

    assert response.status_code == 200
    assert "count" in response.data
    assert isinstance(response.data["count"], int)


@pytest.mark.django_db
def test_failed_count_api_requires_auth():
    client = APIClient()
    url = reverse("metrics:failed_count_api")
    response = client.get(url)
    assert response.status_code in (401, 403)
