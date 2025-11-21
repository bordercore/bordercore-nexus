"""
URL configuration for the Accounts app.
"""

from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path(
        route="store_in_session/",
        view=views.store_in_session,
        name="store_in_session"
    ),
    path(
        route="prefs/",
        view=views.UserProfileUpdateView.as_view(),
        name="prefs"
    ),
    path(
        route="password/",
        view=views.ChangePasswordView.as_view(),
        name="password"
    ),
    path(
        route="login/",
        view=views.bc_login,
        name="login"
    ),
    path(
        route="logout/",
        view=views.bc_logout,
        name="logout"
    ),
    path(
        route="note/sort/",
        view=views.sort_pinned_notes,
        name="sort_pinned_notes"
    ),
    path(
        route="note/pin/",
        view=views.pin_note,
        name="pin_note"
    ),
]
