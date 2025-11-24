"""
URL configuration for the Metrics app.
"""

from django.urls import path

from . import views

app_name = "metrics"

urlpatterns = [
    path(
        route="",
        view=views.MetricListView.as_view(),
        name="list"
    ),
]
