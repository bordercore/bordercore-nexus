"""Views for the metrics application.

This module contains views for displaying and managing metrics tracking,
including test results, coverage reports, and other periodic measurements.
"""
from typing import Any, cast

from django.contrib.auth.mixins import (LoginRequiredMixin,
                                        PermissionRequiredMixin)
from django.contrib.auth.models import User
from django.db.models import QuerySet
from django.utils import timezone
from django.views.generic.list import ListView

from .models import Metric


class MetricListView(LoginRequiredMixin, PermissionRequiredMixin, ListView):
    """View for displaying the metrics list page.

    Shows the latest metrics for the current user, including test results,
    coverage data, and overdue status. Only accessible to admin users.
    """

    model = Metric
    template_name = "metrics/metric_list.html"
    context_object_name = "metrics"
    permission_required = "metrics.view_metric"

    test_types = {
        Metric.UNIT_TESTS_NAME: "unit",
        Metric.FUNCTIONAL_TESTS_NAME: "functional",
        Metric.DATA_QUALITY_TESTS_NAME: "data",
        Metric.WUMPUS_TESTS_NAME: "wumpus",
        Metric.COVERAGE_METRIC_NAME: "coverage",
        Metric.COVERAGE_REPORT_NAME: "coverage_report"
    }

    def test_func(self) -> bool:
        """Check if the current user is an admin.

        Returns:
            True if the user belongs to the "Admin" group, False otherwise.
        """
        return self.request.user.groups.filter(name="Admin").exists()

    def get_queryset(self) -> QuerySet[Metric]:
        """Get the queryset of latest metrics for the current user.

        Returns:
            QuerySet of Metric objects containing the latest metric data
            for the logged-in user.
        """
        user = cast(User, self.request.user)
        return Metric.objects.latest_metrics(user)

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the metrics list view.

        Processes metrics to determine overdue status, formats coverage
        percentages, and organizes metrics by test type for display.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - title: Page title
                - metrics: List of metric objects
                - unit: Unit test metric (if available)
                - functional: Functional test metric (if available)
                - data: Data quality test metric (if available)
                - wumpus: Wumpus test metric (if available)
                - coverage: Test coverage metric (if available)
                - coverage_repot: Coverage report metric (if available)
        """
        context = super().get_context_data(**kwargs)

        context["title"] = "Bordercore Metrics"
        now = timezone.now()

        for metric in self.object_list:

            if metric.created:  # type: ignore[attr-defined]

                if now - metric.created > metric.frequency:  # type: ignore[attr-defined]
                    metric.overdue = True

                test_type = self.test_types.get(metric.name)
                if test_type:
                    context[test_type] = metric
                if metric.name == Metric.COVERAGE_METRIC_NAME:
                    metric.latest_result["line_rate"] = int(round(float(metric.latest_result["line_rate"]) * 100, 0))  # type: ignore[attr-defined]

        return context
