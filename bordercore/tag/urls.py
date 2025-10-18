"""
URL configuration for the Tag app.
"""

from django.urls import path

from . import views

app_name = "tag"

urlpatterns = [
    path(
        route="search",
        view=views.search,
        name="search"
    ),
    path(
        route="pin/",
        view=views.pin,
        name="pin"
    ),
    path(
        route="unpin/",
        view=views.unpin,
        name="unpin"
    ),
    path(
        route="list",
        view=views.TagListView.as_view(),
        name="list"
    ),
    path(
        route="add_alias",
        view=views.add_alias,
        name="add_alias"
    ),
    path(
        route="get_todo_counts",
        view=views.get_todo_counts,
        name="get_todo_counts"
    ),
    path(
        route="get_related_tags",
        view=views.get_related_tags,
        name="get_related_tags"
    ),
]
