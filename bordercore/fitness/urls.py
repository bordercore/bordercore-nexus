"""
URL configuration for the Fitness app.
"""

from django.urls import path

from . import views

app_name = "fitness"

urlpatterns = [
    path(
        route="add/<uuid:exercise_uuid>/",
        view=views.fitness_add,
        name="add"
    ),
    path(
        route="log_set/<uuid:exercise_uuid>/",
        view=views.log_set,
        name="log_set"
    ),
    path(
        route="delete_set/",
        view=views.delete_set,
        name="delete_set"
    ),
    path(
        route="change_active_status/",
        view=views.change_active_status,
        name="change_active_status"
    ),
    path(
        route="swap_active_exercise/",
        view=views.swap_active_exercise,
        name="swap_active_exercise"
    ),
    path(
        route="<uuid:uuid>/",
        view=views.ExerciseDetailView.as_view(),
        name="exercise_detail"
    ),
    path(
        route="",
        view=views.fitness_summary,
        name="summary"
    ),
    path(
        route="edit_note/",
        view=views.edit_note,
        name="edit_note"
    ),
    path(
        route="get_workout_data/",
        view=views.get_workout_data,
        name="get_workout_data"
    ),
    path(
        route="update_schedule/",
        view=views.update_schedule,
        name="update_schedule"
    ),
    path(
        route="update_rest_period/",
        view=views.update_rest_period,
        name="update_rest_period"
    ),
]
