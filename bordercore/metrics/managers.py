"""Custom manager for metrics queries and annotations.

This module provides MetricsManager, a Django manager extension that adds
custom queryset methods for querying metrics with their latest data points
and annotations for the metrics tracking system.
"""

from typing import TYPE_CHECKING

from django.apps import apps
from django.contrib.auth.models import User
from django.db import models
from django.db.models import OuterRef, QuerySet, Subquery

if TYPE_CHECKING:
    from metrics.models import Metric


class MetricsManager(models.Manager):
    """Custom manager for metric queries with latest data annotations.

    This manager extends Django's base Manager to provide methods for:
    - Querying metrics with their latest result values and timestamps
    - Annotating metrics with subqueries for efficient data retrieval

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
