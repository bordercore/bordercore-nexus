"""
URL configuration for the Feed app.
"""

from django.urls import path

from . import views

app_name = "feed"

urlpatterns = [
    path(
        route="sort/",
        view=views.sort_feed,
        name="sort"
    ),
    path(
        route="check_url/<str:url>/",
        view=views.check_url,
        name="check_url"
    ),
    path(
        route="",
        view=views.FeedListView.as_view(),
        name="list"
    ),
]
