import html

from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import UserPassesTestMixin
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.generic.list import ListView

from .models import Metric


@method_decorator(login_required, name="dispatch")
class MetricListView(UserPassesTestMixin, ListView):

    model = Metric
    template_name = "metrics/metric_list.html"
    context_object_name = "metrics"

    test_types = {
        "Bordercore Unit Tests": "unit",
        "Bordercore Functional Tests": "functional",
        "Bordercore Data Quality Tests": "data",
        "Bordercore Wumpus Tests": "wumpus",
        "Bordercore Test Coverage": "coverage",
        "Bordercore Coverage Report": "coverage_repot"
    }

    def test_func(self):
        """
        Only admin users may view this page
        """
        return self.request.user.groups.filter(name="Admin").exists()

    def get_queryset(self):

        return Metric.objects.latest_metrics(self.request.user)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        context["title"] = "Bordercore Metrics"

        for metric in self.object_list:

            if metric.created:

                if timezone.now() - metric.created > metric.frequency:
                    metric.overdue = True

                context[self.test_types[metric.name]] = metric
                if metric.name == "Bordercore Test Coverage":
                    metric.latest_result["line_rate"] = int(round(float(metric.latest_result["line_rate"]) * 100, 0))

        return context
