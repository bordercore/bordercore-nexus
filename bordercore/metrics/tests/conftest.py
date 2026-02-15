from datetime import timedelta

import pytest
from django.utils import timezone

from metrics.models import Metric, MetricData


@pytest.fixture()
def metrics(authenticated_client):

    user, _ = authenticated_client()

    m_0 = Metric.objects.create(name="Bordercore Unit Tests", user=user)
    m_1 = Metric.objects.create(name="Bordercore Functional Tests", user=user)
    m_2 = Metric.objects.create(name="Bordercore Test Coverage", user=user)

    md = MetricData.objects.create(
        metric=m_0,
        value={
            "test_failures": 2,
            "test_errors": 1,
            "test_skipped": 0,
            "test_count": 10,
            "test_time_elapsed": "03:18",
            "test_output": ""
        }
    )

    md = MetricData.objects.create(
        metric=m_1,
        value={
            "test_failures": 0,
            "test_errors": 1,
            "test_skipped": 0,
            "test_count": 20,
            "test_time_elapsed": "01:53",
            "test_output": ""
        }
    )
    # Overdue metrics
    md.created = timezone.now() - timedelta(days=3)
    md.save()

    # Test coverage metrics
    md = MetricData.objects.create(
        metric=m_2,
        value={
            "line_rate": 0.82
        }
    )

    yield [m_0, m_1, m_2]
