"""
URL configuration for the Collection app.
"""

from django.urls import path

from . import views

app_name = "collection"

urlpatterns = [
    path(
        route="",
        view=views.CollectionListView.as_view(),
        name="list"
    ),
    path(
        route="create/",
        view=views.CollectionCreateView.as_view(),
        name="create"
    ),
    path(
        route="update/<uuid:uuid>/",
        view=views.CollectionUpdateView.as_view(),
        name="update"
    ),
    path(
        route="<uuid:uuid>/",
        view=views.CollectionDetailView.as_view(),
        name="detail"
    ),
    path(
        route="delete/<uuid:uuid>/",
        view=views.CollectionDeleteView.as_view(),
        name="delete"
    ),
    path(
        route="get_blob/<uuid:collection_uuid>/",
        view=views.get_blob,
        name="get_blob"
    ),
    path(
        route="search",
        view=views.search,
        name="search"
    ),
    path(
        route="get_object_list/<uuid:collection_uuid>/",
        view=views.get_object_list,
        name="get_object_list"
    ),
    path(
        route="create_blob",
        view=views.create_blob,
        name="create_blob"
    ),
    path(
        route="get_object_list/<uuid:collection_uuid>/",
        view=views.get_object_list,
        name="get_object_list"
    ),
    path(
        route="object/add",
        view=views.add_object,
        name="add_object"
    ),
    path(
        route="object/remove",
        view=views.remove_object,
        name="remove_object"
    ),
    path(
        route="object/sort",
        view=views.sort_objects,
        name="sort_objects"
    ),
    path(
        route="object/note/update",
        view=views.update_object_note,
        name="update_object_note"
    ),
    path(
        route="add/bookmark",
        view=views.add_new_bookmark,
        name="add_new_bookmark"
    ),
]
