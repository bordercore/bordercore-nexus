"""Tests for the recently-viewed JSON API used by the live topbar dropdown."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory


@pytest.mark.django_db
def test_recently_viewed_api_returns_blob_list():
    user = UserFactory()
    client = APIClient()
    client.force_authenticate(user=user)

    url = reverse("blob:recently_viewed_api")
    response = client.get(url)

    assert response.status_code == 200
    assert "blobList" in response.data
    assert isinstance(response.data["blobList"], list)


@pytest.mark.django_db
def test_recently_viewed_api_requires_auth():
    client = APIClient()
    url = reverse("blob:recently_viewed_api")
    response = client.get(url)
    assert response.status_code in (401, 403)
