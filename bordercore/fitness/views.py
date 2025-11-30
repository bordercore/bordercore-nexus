"""Views for fitness tracking (exercise details, summaries, and updates).

This module provides class-based and function-based views to render exercise
details, add workout data, toggle a user's active exercises, update schedules
and notes, and fetch paginated plot data for workouts.
"""

from __future__ import annotations

import json
from typing import Any, Dict, TypedDict, cast

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.db import transaction
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST
from django.views.generic.detail import DetailView

from fitness.services import get_fitness_summary
from lib.decorators import validate_post_data

from .models import Data, Exercise, ExerciseUser, Workout


class ExerciseDetailView(LoginRequiredMixin, DetailView):
    """Show details for a single :class:`Exercise` including history and plots.

    The view looks up the exercise by its UUID slug and enriches the context
    with the latest workout summary, plot data, related exercises, and the
    requesting user's activity/schedule info for this exercise.
    """

    model = Exercise
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def get_context_data(self, **kwargs: Any) -> Dict[str, Any]:
        """Build the template context for the exercise detail page.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            dict[str, Any]: A context dictionary containing:
                - ``object``: The current :class:`Exercise` (from ``DetailView``).
                - ``related_exercises``: List of brief dicts describing
                  exercises that share targeted muscles.
                - ``activity_info``: The user's schedule info for this exercise
                  (or a default disabled schedule).
                - ``title``: A string for the page title.
                - Keys from ``last_workout`` if available (recent stats).
        """
        context = super().get_context_data(**kwargs)

        last_workout = self.object.last_workout(self.request.user)

        related_exercises = [
            {
                "uuid": x.uuid,
                "name": x.name,
                "last_active": x.last_active.strftime("%Y-%m-%d") if x.last_active else "Never",
            }
            for x in self.object.get_related_exercises()
        ]

        user = cast(User, self.request.user)
        active = ExerciseUser.objects.filter(
            user=user,
            exercise__id=self.object.id,
        ).first()

        context["activity_info"] = (active.activity_info() if active else {"schedule": [False] * 7})

        # Merge and return final context.
        return {
            **context,
            **last_workout,
            "title": f"Exercise Detail :: {self.object.name}",
            "related_exercises": related_exercises,
        }


@login_required
@require_POST
@validate_post_data("workout-data")
def fitness_add(request: HttpRequest, exercise_uuid: str) -> HttpResponse:
    """Create a new :class:`Workout` and associated :class:`Data` rows.

    Expects a POST with:
        - ``note`` (optional): Workout note.
        - ``workout-data`` (required): JSON array of objects with keys
          ``weight``, ``duration``, and ``reps``.

    Args:
        request: The HTTP request object.
        exercise_uuid: The UUID of the :class:`Exercise` to record a workout for.

    Returns:
        HttpResponse: Redirects to the fitness summary view when complete.
    """
    exercise = Exercise.objects.get(uuid=exercise_uuid)
    user = cast(User, request.user)
    payload = json.loads(request.POST["workout-data"])

    with transaction.atomic():
        workout = Workout.objects.create(user=user, exercise=exercise, note=request.POST.get("note", ""))
        Data.objects.bulk_create(
            [
                Data(
                    workout=workout,
                    weight=datum.get("weight") or 0,
                    duration=datum.get("duration") or 0,
                    reps=datum.get("reps") or 0,
                )
                for datum in payload
                if isinstance(datum, dict)
            ],
            ignore_conflicts=False,
        )

    messages.add_message(
        request,
        messages.INFO,
        f"Added workout data for exercise <strong>{exercise}</strong>",
    )

    return redirect("fitness:summary")


@login_required
def fitness_summary(request: HttpRequest) -> HttpResponse:
    """Render a summary page with active/inactive exercises for the user.

    Args:
        request: The HTTP request object.

    Returns:
        HttpResponse: Rendered template response for the fitness summary page.
    """
    user = cast(User, request.user)
    exercises = get_fitness_summary(user)

    return render(
        request,
        "fitness/summary.html",
        {
            "active_exercises": exercises[0],
            "inactive_exercises": exercises[1],
            "title": "Fitness Summary",
        },
    )


@login_required
@require_POST
@validate_post_data("uuid")
def change_active_status(request: HttpRequest) -> JsonResponse:
    """Toggle a user's active status for an exercise, or remove it entirely.

    Expects a POST with:
        - ``uuid`` (required): Exercise UUID.
        - ``remove`` (optional): If ``"true"``, deletes the :class:`ExerciseUser`
          record; otherwise creates/updates it and returns the activity info.

    Args:
        request: The HTTP request object.

    Returns:
        Json response with ``info`` payload and status.
    """
    uuid = request.POST["uuid"]
    remove = request.POST.get("remove", "false")

    user = cast(User, request.user)
    if remove == "true":
        eu = ExerciseUser.objects.get(user=user, exercise__uuid=uuid)
        eu.delete()
        info = {}
    else:
        exercise = Exercise.objects.get(uuid=uuid)
        eu = ExerciseUser(
            user=user,
            exercise=exercise,
            schedule=[True, False, False, False, False, False, False],
        )
        eu.save()
        info = eu.activity_info()

    return JsonResponse({"info": info, "status": "OK"})


@login_required
@require_POST
@validate_post_data("uuid", "note")
def edit_note(request: HttpRequest) -> JsonResponse:
    """Update the ``note`` field for an :class:`Exercise`.

    Expects a POST with:
        - ``uuid``: Exercise UUID.
        - ``note``: New note text.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with operation status.
    """
    exercise_uuid = request.POST["uuid"]
    note = request.POST["note"]

    exercise = Exercise.objects.get(uuid=exercise_uuid)
    exercise.note = note
    exercise.save()

    response = {"status": "OK"}
    return JsonResponse(response)


@login_required
def get_workout_data(request: HttpRequest) -> JsonResponse:
    """Return paginated plot data for an exercise's workouts.

    Accepts a GET with:
        - ``uuid`` (required): Exercise UUID.
        - ``page_number`` (optional): 1-based integer; defaults to 1.

    Args:
        request: The HTTP request object.

    Returns:
        Json response with ``workout_data`` payload and status.
    """
    exercise_uuid = request.GET["uuid"]
    page_number = int(request.GET.get("page_number", 1))

    exercise = Exercise.objects.get(uuid=exercise_uuid)

    workout_data = exercise.get_plot_info(page_number=page_number)

    response = {"status": "OK", "workout_data": workout_data}
    return JsonResponse(response)


@login_required
@require_POST
@validate_post_data("uuid", "schedule")
def update_schedule(request: HttpRequest) -> JsonResponse:
    """Update the weekly schedule for a user's :class:`ExerciseUser` record.

    Expects a POST with:
        - ``uuid``: Exercise UUID.
        - ``schedule``: Comma-separated booleans (e.g., ``"true,false,..."``).

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with operation status.
    """
    uuid = request.POST["uuid"]
    schedule = request.POST["schedule"]

    # Convert each string to its corresponding Boolean value
    # "true" should become True, "false" should become False
    boolean_values = [s.lower() == "true" for s in schedule.split(",")]

    user = cast(User, request.user)
    eu = ExerciseUser.objects.get(user=user, exercise__uuid=uuid)
    eu.schedule = boolean_values
    eu.save()

    return JsonResponse({"status": "OK"})


@login_required
@require_POST
@validate_post_data("uuid", "rest_period")
def update_rest_period(request: HttpRequest) -> JsonResponse:
    """Update the ``rest_period`` (in seconds/minutes as defined by the model).

    Expects a POST with:
        - ``uuid``: Exercise UUID.
        - ``rest_period``: Stringified numeric value.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with operation status.
    """
    uuid = request.POST["uuid"]
    rest_period = request.POST["rest_period"]

    user = cast(User, request.user)
    eu = ExerciseUser.objects.get(user=user, exercise__uuid=uuid)
    # Assign as string; Django model field will coerce/validate at save time.
    eu.rest_period = rest_period
    eu.save()

    return JsonResponse({"status": "OK"})
