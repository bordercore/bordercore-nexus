"""
URL configuration for the Habit app.
"""

from django.urls import path

from . import views

app_name = "habit"

urlpatterns = [
    path(
        route="log/",
        view=views.log_habit,
        name="log"
    ),
    path(
        route="get_habits/",
        view=views.get_habits,
        name="get_habits"
    ),
    path(
        route="<uuid:uuid>/",
        view=views.HabitDetailView.as_view(),
        name="detail"
    ),
    path(
        route="",
        view=views.HabitListView.as_view(),
        name="list"
    ),
]
