"""Tests for the live-sync signal handler on MetricData."""

from unittest.mock import patch

import pytest

from accounts.tests.factories import UserFactory
from metrics.models import Metric, MetricData


@pytest.mark.django_db
def test_metric_data_save_sends_failed_count_changed_to_user_group():
    user = UserFactory()
    metric = Metric.objects.create(name="test metric", user=user)
    with patch("metrics.signals.async_to_sync") as mock_sync:
        MetricData.objects.create(metric=metric, value={"test_failures": 1})
    mock_sync.assert_called()
    mock_sync.return_value.assert_called_with(
        f"metrics.user.{user.id}",
        {"type": "failed_count.changed"},
    )


@pytest.mark.django_db
def test_channel_layer_error_does_not_break_metric_data_write(caplog):
    """If Redis is down, recording a MetricData row must still succeed."""
    user = UserFactory()
    metric = Metric.objects.create(name="test metric", user=user)
    with patch("metrics.signals.async_to_sync") as mock_sync:
        mock_sync.side_effect = ConnectionError("redis down")
        # Must not raise:
        md = MetricData.objects.create(metric=metric, value={"test_failures": 0})
    assert md.pk is not None
    assert any("Failed to send failed_count.changed" in rec.message for rec in caplog.records)
