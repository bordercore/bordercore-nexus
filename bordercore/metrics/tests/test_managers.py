"""Tests for MetricsManager numeric coercion of free-form metric JSON."""

import pytest

from metrics.models import Metric, MetricData


@pytest.mark.django_db
def test_get_failed_test_count_tolerates_non_numeric(authenticated_client):
    """Non-numeric/missing values in metric JSON must not 500 the count."""
    user, _ = authenticated_client()

    m = Metric.objects.create(name="Bordercore Unit Tests", user=user)
    MetricData.objects.create(
        metric=m,
        value={"test_failures": "", "test_errors": "oops", "test_count": 10},
    )

    cov = Metric.objects.create(name=Metric.COVERAGE_METRIC_NAME, user=user)
    MetricData.objects.create(metric=cov, value={"line_rate": "n/a"})

    # Must not raise; non-numeric values are treated as zero.
    count = Metric.objects.get_failed_test_count(user)
    assert isinstance(count, int)


@pytest.mark.django_db
def test_get_failed_test_count_sums_valid_values(authenticated_client):
    """Valid numeric errors/failures are summed."""
    user, _ = authenticated_client()

    m = Metric.objects.create(name="Bordercore Unit Tests", user=user)
    MetricData.objects.create(
        metric=m,
        value={"test_failures": 2, "test_errors": 1, "test_count": 10},
    )

    assert Metric.objects.get_failed_test_count(user) == 3
