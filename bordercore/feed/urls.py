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
        route="items/<int:pk>/read/",
        view=views.mark_item_read,
        name="mark_item_read"
    ),
    path(
        route="<uuid:feed_uuid>/mark_all_read/",
        view=views.mark_feed_read,
        name="mark_feed_read"
    ),
    path(
        route="",
        view=views.FeedListView.as_view(),
        name="list"
    ),
]
