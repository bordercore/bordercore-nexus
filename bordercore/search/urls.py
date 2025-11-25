"""
URL configuration for the Search app.
"""

from django.urls import path, re_path

from . import views

app_name = "search"

urlpatterns = [
    path(
        route="tagstitle/",
        view=views.search_tags_and_names,
        name="search_tags_and_names"
    ),
    re_path(
        route=r"^tagdetail/(?P<taglist>.*)/",
        view=views.SearchTagDetailView.as_view(),
        name="kb_search_tag_detail"
    ),
    path(
        route="tagdetail/",
        view=views.SearchTagDetailView.as_view(),
        name="kb_search_tag_detail_search"
    ),
    path(
        route="",
        view=views.SearchListView.as_view(),
        name="search"
    ),
    path(
        route="semantic",
        view=views.SemanticSearchListView.as_view(),
        name="semantic"
    ),
    path(
        route="notes",
        view=views.NoteListView.as_view(),
        name="notes"
    ),
    path(
        route="names",
        view=views.search_names,
        name="search_names"
    ),
]
