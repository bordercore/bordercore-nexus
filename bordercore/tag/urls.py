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
        route="",
        view=views.tag_list_redirect,
        name="index"
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
    path(
        route="set_meta/",
        view=views.set_meta,
        name="set_meta"
    ),
    path(
        route="<str:name>/snapshot.json",
        view=views.snapshot,
        name="snapshot"
    ),
    path(
        route="<str:name>/",
        view=views.TagDetailView.as_view(),
        name="detail"
    ),
]
