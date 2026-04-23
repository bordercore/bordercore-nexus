"""Views for fitness tracking (exercise details, summaries, and updates).

This module provides class-based and function-based views to render exercise
details, add workout data, toggle a user's active exercises, update schedules
and notes, and fetch paginated plot data for workouts.
"""

from __future__ import annotations

import json
from typing import Any, cast

from rest_framework.decorators import api_view
from rest_framework.response import Response

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.db import transaction
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone

from lib.mixins import get_user_object_or_404
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

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
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
                "uuid": str(x.uuid),
                "name": x.name,
                "last_active": x.last_active.strftime("%Y-%m-%d") if x.last_active else "Never",
                "exercise_url": reverse("fitness:exercise_detail", args=[x.uuid]),
            }
            for x in self.object.get_related_exercises()
        ]

        user = cast(User, self.request.user)
        active = ExerciseUser.objects.filter(
            user=user,
            exercise__id=self.object.id,
        ).first()

        if active:
            activity_info = active.activity_info()
            activity_info["rest_period"] = active.rest_period
            activity_info["schedule_days"] = ExerciseUser.schedule_days(active.schedule)
            activity_info["is_active"] = True
        else:
            activity_info = {
                "schedule": [False] * 7,
                "schedule_days": "",
                "is_active": False,
            }

        # Get targeted muscles (convert Muscle objects to strings)
        targeted_muscles_raw = self.object.get_targeted_muscles()
        targeted_muscles = {
            "primary": [str(m) for m in targeted_muscles_raw.get("primary", [])],
            "secondary": [str(m) for m in targeted_muscles_raw.get("secondary", [])],
        }

        # Prepare JSON data for React
        context["activity_info_json"] = json.dumps(activity_info)
        context["related_exercises_json"] = json.dumps(related_exercises)
        context["targeted_muscles_json"] = json.dumps(targeted_muscles)

        # Last workout data for React
        recent_data = last_workout.get("recent_data", [])
        context["last_workout_date"] = (
            recent_data[0].date.strftime("%b %d, %Y") if recent_data else ""
        )
        context["delta_days"] = last_workout.get("delta_days", 7)
        context["latest_weight_json"] = json.dumps(last_workout.get("latest_weight", [0]))
        context["latest_reps_json"] = json.dumps(last_workout.get("latest_reps", [0]))
        context["latest_duration_json"] = json.dumps(last_workout.get("latest_duration", [0]))

        # Previous workout data for delta computation on the Last Workout card.
        recent_workout_ids = list(
            Workout.objects.filter(user=user, exercise=self.object)
            .order_by("-date")
            .values_list("pk", flat=True)[:2]
        )
        prev_weight: list[float] = []
        prev_reps: list[int] = []
        prev_duration: list[int] = []
        if len(recent_workout_ids) >= 2:
            prev_data = list(
                Data.objects.filter(workout_id=recent_workout_ids[1]).order_by("id")
            )
            prev_weight = [d.weight or 0 for d in prev_data]
            prev_reps = [d.reps or 0 for d in prev_data]
            prev_duration = [d.duration or 0 for d in prev_data]
        context["previous_weight_json"] = json.dumps(prev_weight)
        context["previous_reps_json"] = json.dumps(prev_reps)
        context["previous_duration_json"] = json.dumps(prev_duration)

        # Merge and return final context.
        return {
            **context,
            **last_workout,
            "title": f"Exercise Detail :: {self.object.name}",
            "related_exercises": related_exercises,
        }


@api_view(["POST"])
@validate_post_data("reps")
def log_set(request: HttpRequest, exercise_uuid: str) -> Response:
    """Create a single :class:`Data` row against today's :class:`Workout`.

    Gets or creates the :class:`Workout` for (user, exercise) dated today
    (in the server's local timezone), then appends one set. Supports the
    per-set "log set" composer in the redesigned exercise detail page.

    Expects a POST with:
        - ``reps`` (required): integer string.
        - ``weight`` (optional): numeric string; stored as 0 when omitted.
        - ``duration`` (optional): integer string; stored as 0 when omitted.
        - ``note`` (optional): appended to the Workout's note on first set.

    Args:
        request: The HTTP request object.
        exercise_uuid: The UUID of the :class:`Exercise` being logged.

    Returns:
        JSON response with the newly created set (``id``, ``weight``,
        ``reps``, ``duration``, ``index``).
    """
    exercise = get_object_or_404(Exercise, uuid=exercise_uuid)
    user = cast(User, request.user)

    try:
        reps = int(request.POST["reps"])
    except (TypeError, ValueError):
        return Response({"detail": "reps must be an integer"}, status=400)

    try:
        weight = float(request.POST.get("weight") or 0)
    except (TypeError, ValueError):
        return Response({"detail": "weight must be numeric"}, status=400)

    try:
        duration = int(request.POST.get("duration") or 0)
    except (TypeError, ValueError):
        return Response({"detail": "duration must be an integer"}, status=400)

    today_local = timezone.localdate()
    note = request.POST.get("note", "")

    with transaction.atomic():
        workout = (
            Workout.objects.filter(
                user=user, exercise=exercise, date__date=today_local
            )
            .order_by("-date")
            .first()
        )
        if workout is None:
            workout = Workout.objects.create(user=user, exercise=exercise, note=note)
        elif note and not workout.note:
            workout.note = note
            workout.save(update_fields=["note"])

        datum = Data.objects.create(
            workout=workout,
            weight=weight,
            reps=reps,
            duration=duration,
        )
        index = workout.data_set.count()

    return Response({
        "set": {
            "id": datum.id,
            "weight": datum.weight,
            "reps": datum.reps,
            "duration": datum.duration,
            "index": index,
        }
    })


@api_view(["POST"])
@validate_post_data("id")
def delete_set(request: HttpRequest) -> Response:
    """Delete a single :class:`Data` row owned by the requesting user.

    If the parent :class:`Workout` has no remaining sets after the deletion,
    the Workout is also deleted.

    Expects a POST with:
        - ``id`` (required): Data row primary key.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with a ``workout_deleted`` flag indicating whether the
        parent Workout was also removed.
    """
    user = cast(User, request.user)

    try:
        set_id = int(request.POST["id"])
    except (TypeError, ValueError):
        return Response({"detail": "id must be an integer"}, status=400)

    datum = get_object_or_404(Data, pk=set_id, workout__user=user)

    with transaction.atomic():
        workout = datum.workout
        datum.delete()
        workout_deleted = False
        if not workout.data_set.exists():
            workout.delete()
            workout_deleted = True

    return Response({"workout_deleted": workout_deleted})


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
    exercise = get_object_or_404(Exercise, uuid=exercise_uuid)
    user = cast(User, request.user)

    try:
        payload = json.loads(request.POST["workout-data"])
    except json.JSONDecodeError:
        messages.error(request, "Invalid workout data format.")
        return redirect("fitness:summary")

    sets = [datum for datum in payload if isinstance(datum, dict)]
    if not sets:
        messages.error(request, "At least one valid set is required.")
        return redirect("fitness:summary")

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
                for datum in sets
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
    active_exercises, inactive_exercises = get_fitness_summary(user)

    def serialize_exercise(e: Exercise, include_schedule: bool = False) -> dict:
        """Serialize an exercise for JSON."""
        from django.urls import reverse

        last_active = getattr(e, "last_active", None)
        data = {
            "exercise_url": reverse("fitness:exercise_detail", args=[e.uuid]),
            "exercise": e.name,
            "muscle_group": str(muscles[0].muscle_group) if (muscles := e.muscle.all()) else "",
            "last_active": last_active.strftime("%Y-%m-%d") if last_active else None,
            "last_active_unixtime": str(int(last_active.timestamp())) if last_active else "0",
            "delta_days": e.delta_days if hasattr(e, "delta_days") else None,
            "overdue": e.overdue if hasattr(e, "overdue") else 0,
        }
        if include_schedule:
            data["schedule_days"] = e.schedule_days if hasattr(e, "schedule_days") else ""
            data["schedule"] = e.schedule if hasattr(e, "schedule") else []
            data["frequency"] = (
                f"{e.frequency.days} day{'s' if e.frequency.days != 1 else ''}"
                if hasattr(e, "frequency") and e.frequency
                else ""
            )
        return data

    active_exercises_json = json.dumps(
        [serialize_exercise(e, include_schedule=True) for e in active_exercises]
    )
    inactive_exercises_json = json.dumps([serialize_exercise(e) for e in inactive_exercises])

    return render(
        request,
        "fitness/summary.html",
        {
            "active_exercises_json": active_exercises_json,
            "inactive_exercises_json": inactive_exercises_json,
            "title": "Fitness Summary",
        },
    )


@api_view(["POST"])
@validate_post_data("uuid")
def change_active_status(request: HttpRequest) -> Response:
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
        eu = get_user_object_or_404(user, ExerciseUser, exercise__uuid=uuid)
        eu.delete()
        info = {}
    else:
        exercise = get_object_or_404(Exercise, uuid=uuid)
        eu, _ = ExerciseUser.objects.get_or_create(
            user=user,
            exercise=exercise,
            defaults={"schedule": [True, False, False, False, False, False, False]},
        )
        info = eu.activity_info()

    return Response({"info": info})


@api_view(["POST"])
@validate_post_data("from_uuid", "to_uuid")
def swap_active_exercise(request: HttpRequest) -> Response:
    """Swap which exercise in a muscle group is on the user's active list.

    Rotates the active slot from ``from_uuid`` to ``to_uuid`` atomically:
    the source :class:`ExerciseUser` is deleted and a new one is created
    for the target exercise. The source exercise's schedule and rest period
    are carried over so the user keeps the same cadence on the replacement.

    Expects a POST with:
        - ``from_uuid``: UUID of the currently-active exercise to step off.
        - ``to_uuid``: UUID of the replacement exercise to activate.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with ``info`` (activity_info for the newly-active
        exercise) and ``to_url`` (the detail-page URL to navigate to).
    """
    from_uuid = request.POST["from_uuid"]
    to_uuid = request.POST["to_uuid"]

    user = cast(User, request.user)

    from_exercise = get_object_or_404(Exercise, uuid=from_uuid)
    to_exercise = get_object_or_404(Exercise, uuid=to_uuid)
    from_eu = get_user_object_or_404(user, ExerciseUser, exercise=from_exercise)

    carried_schedule = list(from_eu.schedule) if from_eu.schedule else [False] * 7
    carried_rest_period = from_eu.rest_period

    with transaction.atomic():
        from_eu.delete()
        to_eu, _ = ExerciseUser.objects.get_or_create(
            user=user,
            exercise=to_exercise,
            defaults={
                "schedule": carried_schedule,
                "rest_period": carried_rest_period,
            },
        )
        # On collision (to_exercise was already active), keep its existing
        # values — don't overwrite the user's intent there.

    info = to_eu.activity_info()
    info["rest_period"] = to_eu.rest_period
    info["schedule_days"] = ExerciseUser.schedule_days(to_eu.schedule)
    info["is_active"] = True

    return Response({
        "info": info,
        "to_url": reverse("fitness:exercise_detail", args=[to_exercise.uuid]),
    })


@api_view(["POST"])
@validate_post_data("uuid", "note")
def edit_note(request: HttpRequest) -> Response:
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

    user = cast(User, request.user)
    get_user_object_or_404(user, ExerciseUser, exercise__uuid=exercise_uuid)

    exercise = get_object_or_404(Exercise, uuid=exercise_uuid)
    exercise.note = note
    exercise.save()

    return Response()


@api_view(["GET"])
def get_workout_data(request: HttpRequest) -> Response:
    """Return paginated plot data for an exercise's workouts.

    Accepts a GET with:
        - ``uuid`` (required): Exercise UUID.
        - ``page_number`` (optional): 1-based integer; defaults to 1.

    Args:
        request: The HTTP request object.

    Returns:
        Json response with ``workout_data`` payload and status.
    """
    exercise_uuid = request.GET.get("uuid")
    if not exercise_uuid:
        return Response({"detail": "Missing required parameter: uuid"}, status=400)

    try:
        page_number = int(request.GET.get("page_number", 1))
        if page_number < 1:
            page_number = 1
    except (ValueError, TypeError):
        page_number = 1

    user = cast(User, request.user)
    exercise = get_object_or_404(Exercise, uuid=exercise_uuid)

    workout_data = exercise.get_plot_info(user=user, page_number=page_number)

    return Response({"workout_data": workout_data})


@api_view(["POST"])
@validate_post_data("uuid", "schedule")
def update_schedule(request: HttpRequest) -> Response:
    """Update (or create) the weekly schedule for a user's :class:`ExerciseUser`.

    Clicking a day pill on an inactive exercise auto-activates the exercise
    with the clicked day set, so this view does a get_or_create on the
    :class:`ExerciseUser` row.

    Expects a POST with:
        - ``uuid``: Exercise UUID.
        - ``schedule``: Comma-separated booleans (e.g., ``"true,false,..."``).

    Args:
        request: The HTTP request object.

    Returns:
        JSON response containing ``info`` (the activity_info bundle) so the
        client can reflect newly-active state in the UI.
    """
    uuid = request.POST["uuid"]
    schedule = request.POST["schedule"]

    # Convert each string to its corresponding Boolean value
    # "true" should become True, "false" should become False
    boolean_values = [s.lower() == "true" for s in schedule.split(",")]

    user = cast(User, request.user)
    exercise = get_object_or_404(Exercise, uuid=uuid)
    eu, _ = ExerciseUser.objects.get_or_create(
        user=user,
        exercise=exercise,
        defaults={"schedule": boolean_values},
    )
    eu.schedule = boolean_values
    eu.save()

    info = eu.activity_info()
    info["rest_period"] = eu.rest_period
    info["schedule_days"] = ExerciseUser.schedule_days(eu.schedule)
    info["is_active"] = True

    return Response({"info": info})


@api_view(["POST"])
@validate_post_data("uuid", "rest_period")
def update_rest_period(request: HttpRequest) -> Response:
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
    eu = get_user_object_or_404(user, ExerciseUser, exercise__uuid=uuid)
    # Assign as string; Django model field will coerce/validate at save time.
    eu.rest_period = rest_period
    eu.save()

    return Response()
