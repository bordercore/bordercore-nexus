"""
URL configuration for the Constellation visualization.
"""
from django.urls import path

from . import views

app_name = "visualize"

urlpatterns = [
    path(
        route="api/graph/",
        view=views.graph_api,
        name="graph_api",
    ),
    path(
        route="",
        view=views.ConstellationPageView.as_view(),
        name="constellation",
    ),
]
