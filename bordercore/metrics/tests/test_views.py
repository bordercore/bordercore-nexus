import pytest

from django import urls
from django.contrib.auth.models import Permission

pytestmark = [pytest.mark.django_db]


def test_metrics_list(authenticated_client, metrics):

    user, client = authenticated_client()

    # Grant the required permission to the test user
    permission = Permission.objects.get(codename="view_metric", content_type__app_label="metrics")
    user.user_permissions.add(permission)

    url = urls.reverse("metrics:list")
    resp = client.get(url)

    assert resp.status_code == 200
