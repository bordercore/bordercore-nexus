"""
Models for the metrics tracking system.

This module defines Metric (a user-defined metric with frequency tracking) and
MetricData (individual data points recorded for a metric). Metrics can track
test results, coverage reports, and other periodic measurements.
"""

import uuid
from datetime import timedelta

from django.contrib.auth.models import User
from django.db import models
from django.db.models import JSONField

from .managers import MetricsManager


class Metric(models.Model):
    """
    A user-defined metric that tracks periodic measurements or test results.

    Each Metric has a name, frequency (how often it should be updated), and
    optional notes. It tracks its latest result via MetricData entries and can
    be used to monitor test failures, coverage rates, and other periodic data.

    Attributes:
        uuid: Stable UUID identifier for this metric.
        name: Human-readable name of the metric (e.g., COVERAGE_METRIC_NAME).
        user: ForeignKey to the User who owns this metric.
        note: Optional free-form text annotation.
        frequency: DurationField indicating how often this metric should be updated.
    """
    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    name = models.TextField()
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    note = models.TextField(blank=True, null=True)
    frequency = models.DurationField(default=timedelta(days=1), blank=False, null=False)

    objects = MetricsManager()

    COVERAGE_MINIMUM = 80
    COVERAGE_REPORT_NAME = "Bordercore Coverage Report"
    COVERAGE_METRIC_NAME = "Bordercore Test Coverage"

    def __str__(self) -> str:
        """Return string representation of the metric.

        Returns:
            The name of the metric.
        """
        return self.name


class MetricData(models.Model):
    """
    A single data point recorded for a Metric.

    Each MetricData entry stores a JSON value (test results, coverage data,
    etc.) along with a timestamp indicating when it was recorded. The latest
    MetricData for a Metric represents its current state.

    Attributes:
        created: DateTimeField automatically set when the data point is created.
        metric: ForeignKey to the Metric this data point belongs to.
        value: JSONField containing the metric's data (test results, coverage
            percentages, etc.).
    """
    created = models.DateTimeField(auto_now_add=True)
    metric = models.ForeignKey(Metric, on_delete=models.CASCADE)
    value = JSONField(blank=True, null=True)

    class Meta:
        ordering = ["-created"]
