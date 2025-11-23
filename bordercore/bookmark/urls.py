"""
URL configuration for the Bookmark app.
"""

from django.urls import path

from . import views

app_name = "bookmark"

urlpatterns = [
    path(
        route="add_note/",
        view=views.add_note,
        name="add_note"
    ),
    path(
        route="click/<uuid:bookmark_uuid>/",
        view=views.click,
        name="click"
    ),
    path(
        route="create/",
        view=views.BookmarkCreateView.as_view(),
        name="create"
    ),
    path(
        route="update/<uuid:uuid>/",
        view=views.BookmarkUpdateView.as_view(),
        name="update"
    ),
    path(
        route="get_new_bookmarks_count/<int:timestamp>/",
        view=views.get_new_bookmarks_count,
        name="get_new_bookmarks_count"
    ),
    path(
        route="get_title_from_url/",
        view=views.get_title_from_url,
        name="get_title_from_url"
    ),
    path(
        route="snarf_link.html",
        view=views.snarf_link,
        name="snarf"
    ),
    path(
        route="overview/",
        view=views.overview,
        name="overview"
    ),
    path(
        route="list/page/<int:page_number>/",
        view=views.BookmarkListView.as_view(),
        name="get_bookmarks_by_page"
    ),
    path(
        route="list/keyword/<str:search>/",
        view=views.BookmarkListView.as_view(),
        name="get_bookmarks_by_keyword"
    ),
    path(
        route="list/tag/<str:tag_filter>/",
        view=views.BookmarkListTagView.as_view(),
        name="get_bookmarks_by_tag"
    ),
    path(
        route="tag/sort/",
        view=views.sort_pinned_tags,
        name="sort_pinned_tags"
    ),
    path(
        route="tag/search/",
        view=views.get_tags_used_by_bookmarks,
        name="get_tags_used_by_bookmarks"
    ),
    path(
        route="sort/",
        view=views.sort_bookmarks,
        name="sort"
    ),
    path(
        route="delete/<uuid:uuid>",
        view=views.BookmarkDeleteView.as_view(),
        name="delete"
    ),
    path(
        route="bookmark/add_tag",
        view=views.add_tag,
        name="add_tag"
    ),
    path(
        route="bookmark/remove_tag",
        view=views.remove_tag,
        name="remove_tag"
    ),
]
