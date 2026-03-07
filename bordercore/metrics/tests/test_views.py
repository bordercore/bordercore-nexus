import json

import pytest

from django import urls
from django.contrib.auth.models import Permission

from accounts.tests.factories import UserFactory

from metrics.models import Metric

pytestmark = [pytest.mark.django_db]

METRICS_LIST_URL = urls.reverse("metrics:list")


def _grant_view_permission(user):
    """Grant the view_metric permission to a user."""
    permission = Permission.objects.get(
        codename="view_metric", content_type__app_label="metrics"
    )
    user.user_permissions.add(permission)


def test_metrics_list(authenticated_client, metrics):
    """Authenticated admin with permission can access the metrics page."""
    user, client = authenticated_client()
    _grant_view_permission(user)

    resp = client.get(METRICS_LIST_URL)

    assert resp.status_code == 200


def test_metrics_list_context_data(authenticated_client, metrics):
    """Context contains unit, functional, and coverage metrics with correct values."""
    user, client = authenticated_client()
    _grant_view_permission(user)

    resp = client.get(METRICS_LIST_URL)
    context = resp.context

    assert "unit" in context
    assert "functional" in context
    assert "coverage" in context

    test_results = json.loads(context["test_results_json"])

    # Unit test fixture: 2 failures, 1 error, 10 total
    assert test_results["unit"]["test_failures"] == "2"
    assert test_results["unit"]["test_errors"] == "1"
    assert test_results["unit"]["test_count"] == "10"

    # Functional test fixture: 0 failures, 1 error, 20 total
    assert test_results["functional"]["test_failures"] == "0"
    assert test_results["functional"]["test_errors"] == "1"

    # Coverage fixture: 0.82 → 82
    assert test_results["coverage"]["line_rate"] == 82


def test_metrics_list_overdue_detection(authenticated_client, metrics):
    """Functional test metric (created 3 days ago, 1-day frequency) is flagged overdue."""
    user, client = authenticated_client()
    _grant_view_permission(user)

    resp = client.get(METRICS_LIST_URL)
    test_results = json.loads(resp.context["test_results_json"])

    assert test_results["functional"]["test_overdue"] is True
    assert test_results["unit"]["test_overdue"] is False


def test_metrics_list_no_permission(authenticated_client):
    """User without view_metric permission is denied access."""
    _, client = authenticated_client()

    resp = client.get(METRICS_LIST_URL)

    assert resp.status_code == 403


def test_metrics_list_not_admin_group(client, django_db_blocker):
    """User with permission but not in Admin group is denied access."""
    from accounts.tests.factories import TEST_PASSWORD

    with django_db_blocker.unblock():
        user = UserFactory()

    _grant_view_permission(user)
    client.login(username=user.username, password=TEST_PASSWORD)

    resp = client.get(METRICS_LIST_URL)

    assert resp.status_code == 403


def test_get_failed_test_count(authenticated_client, metrics):
    """Failed test count includes errors, failures, and overdue metrics."""
    user, _ = authenticated_client()

    count = Metric.objects.get_failed_test_count(user)

    # Unit: 2 failures + 1 error = 3
    # Functional: 0 failures + 1 error + 1 overdue = 2
    # Coverage: 0.82 * 100 = 82 >= 80, not below minimum = 0
    assert count == 5


def test_get_failed_test_count_no_data(authenticated_client):
    """Metric with no MetricData does not crash get_failed_test_count."""
    user, _ = authenticated_client()

    Metric.objects.create(name="Bordercore Unit Tests", user=user)

    count = Metric.objects.get_failed_test_count(user)

    assert count == 0
