"""Custom manager for metrics queries and annotations.

This module provides MetricsManager, a Django manager extension that adds
custom methods for querying metrics with their latest data points and
annotations, as well as calculating failed test counts and overdue metrics
for the metrics tracking system.
"""

from collections.abc import Iterable
from typing import TYPE_CHECKING, Any, Mapping

from django.apps import apps
from django.contrib.auth.models import User
from django.db import models
from django.db.models import OuterRef, QuerySet, Subquery
from django.utils import timezone

if TYPE_CHECKING:
    from metrics.models import Metric


class MetricsManager(models.Manager):
    """Custom manager for metric queries with latest data annotations.

    This manager extends Django's base Manager to provide methods for:
    - Querying metrics with their latest result values and timestamps
    - Annotating metrics with subqueries for efficient data retrieval
    - Calculating failed test counts and overdue metrics

    All methods operate in the context of a specific user and provide
    efficient access to the most recent metric data points.
    """

    def latest_metrics(self, user: User) -> QuerySet["Metric"]:
        """Return metrics annotated with their latest result values and timestamps.

        This method uses subqueries to efficiently retrieve the most recent
        MetricData entry for each metric, annotating the queryset with both
        the latest value and the creation timestamp of that data point.

        Args:
            user: The user to get metrics for.

        Returns:
            QuerySet of Metric objects annotated with 'latest_result' and
            'created' fields from the most recent MetricData entry.
        """

        Metric = apps.get_model("metrics", "Metric")
        MetricData = apps.get_model("metrics", "MetricData")

        newest = MetricData.objects.filter(metric=OuterRef("pk")) \
                                   .order_by("-created")

        return Metric.objects.annotate(
            latest_result=Subquery(newest.values("value")[:1]),
            created=Subquery(newest.values("created")[:1])) \
            .filter(user=user)

    def get_failed_test_count(self, user: User) -> int:
        """Return the total count of failed tests and overdue metrics for a user.

        This method examines all of the user's latest metrics (excluding
        the coverage report metric) and counts:
        - Metrics that are overdue (created date + frequency < now)
        - Test errors and failures from metric results
        - Coverage metrics below the minimum threshold

        Args:
            user: The User whose metrics should be checked.

        Returns:
            Integer count of all failures, errors, and overdue metrics.
        """
        Metric = apps.get_model("metrics", "Metric")
        failed_test_count = 0
        now = timezone.now()

        latest_metrics: Iterable[Mapping[str, Any]] = (
            self.latest_metrics(user)
            .exclude(name=Metric.COVERAGE_REPORT_NAME)
            .values()
        )

        for metric in latest_metrics:
            created = metric["created"]
            frequency = metric["frequency"]
            latest_result = metric.get("latest_result") or {}

            if now - created > frequency:
                failed_test_count += 1

            if "test_errors" in latest_result:
                failed_test_count += int(latest_result["test_errors"])

            if "test_failures" in latest_result:
                failed_test_count += int(latest_result["test_failures"])

            if (
                metric["name"] == Metric.COVERAGE_METRIC_NAME
                and "line_rate" in latest_result
            ):
                line_rate = round(float(latest_result["line_rate"]) * 100)
                if line_rate < Metric.COVERAGE_MINIMUM:
                    failed_test_count += 1

        return failed_test_count
