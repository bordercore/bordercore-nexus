import json

import pytest
from faker import Factory as FakerFactory

from django import urls
from django.contrib.auth.models import User

from fitness.models import Data, Exercise, ExerciseUser, Workout

pytestmark = [pytest.mark.django_db]

faker = FakerFactory.create()


def test_fitness_exercise_detail(authenticated_client, fitness):

    _, client = authenticated_client()

    url = urls.reverse("fitness:exercise_detail", kwargs={"uuid": fitness[0].uuid})
    resp = client.get(url)

    assert resp.status_code == 200

    # Test an inactive exercise

    url = urls.reverse("fitness:exercise_detail", kwargs={"uuid": fitness[1].uuid})
    resp = client.get(url)

    assert resp.status_code == 200


def test_fitness_add(authenticated_client, fitness):

    _, client = authenticated_client()

    url = urls.reverse("fitness:add", kwargs={"exercise_uuid": fitness[0].uuid})
    resp = client.post(url, {
        "workout-data": json.dumps(
            [
                {"weight": 230, "reps": 7, "duration": 0},
                {"weight": 230, "reps": 6, "duration": 0},
                {"weight": 230, "reps": 5, "duration": 0},
            ]
        )
    })

    assert resp.status_code == 302


def test_fitness_summary(authenticated_client, fitness):

    _, client = authenticated_client()

    url = urls.reverse("fitness:summary")
    resp = client.get(url)

    assert resp.status_code == 200
    # The card-grid landing page hands the React layer a single
    # ``data-summary`` JSON blob built by get_fitness_card_summary.
    html = resp.content.decode()
    assert 'id="react-root"' in html
    assert "data-summary" in html
    assert "data-active-exercises" not in html  # legacy attribute removed


def test_fitness_change_active_status(authenticated_client, fitness):

    user, client = authenticated_client()

    url = urls.reverse("fitness:change_active_status")

    resp = client.post(url, {
        "uuid": fitness[0].uuid,
        "remove": "true"
    })

    assert resp.status_code == 200
    assert not ExerciseUser.objects.filter(user=user, exercise__uuid=fitness[0].uuid).exists()

    resp = client.post(url, {
        "uuid": fitness[0].uuid
    })

    assert resp.status_code == 200
    assert ExerciseUser.objects.filter(user=user, exercise__uuid=fitness[0].uuid).exists()


def test_edit_note(authenticated_client, fitness):

    _, client = authenticated_client()

    note = faker.text()

    url = urls.reverse("fitness:edit_note")
    resp = client.post(url, {
        "uuid": fitness[0].uuid,
        "note": note
    })

    assert resp.status_code == 200

    updated_exercise = Exercise.objects.get(uuid=fitness[0].uuid)
    assert updated_exercise.note == note


def test_fitness_get_workout_data(authenticated_client, fitness):

    _, client = authenticated_client()

    url = urls.reverse("fitness:get_workout_data")
    resp = client.get(f"{url}?uuid={fitness[0].uuid}")

    result = resp.json()
    assert resp.status_code == 200
    assert len(result["workout_data"]["labels"]) == 11
    assert len(result["workout_data"]["plot_data"]["reps"]) == 11
    assert len(result["workout_data"]["plot_data"]["reps"][0]) == 4
    assert result["workout_data"]["initial_plot_type"] == "weight"
    assert result["workout_data"]["paginator"]["page_number"] == 1


def test_fitness_update_schedule(authenticated_client, fitness):

    user, client = authenticated_client()

    schedule = [False, True, False, False, False, True, False]

    url = urls.reverse("fitness:update_schedule")
    resp = client.post(url, {
        "uuid": fitness[0].uuid,
        "schedule": ",".join([str(x).lower() for x in schedule])
    })

    assert resp.status_code == 200
    info = resp.json()["info"]
    assert info["is_active"] is True
    assert info["schedule"] == schedule

    updated_exercise_user = ExerciseUser.objects.get(user=user, exercise__uuid=fitness[0].uuid)
    assert updated_exercise_user.schedule == schedule


def test_fitness_update_schedule_auto_activates(authenticated_client, fitness):

    user, client = authenticated_client()

    # fitness[3] (Push Ups) has no ExerciseUser row in the fixture.
    assert not ExerciseUser.objects.filter(user=user, exercise=fitness[3]).exists()

    schedule = [False, False, False, True, False, False, False]

    url = urls.reverse("fitness:update_schedule")
    resp = client.post(url, {
        "uuid": fitness[3].uuid,
        "schedule": ",".join([str(x).lower() for x in schedule])
    })

    assert resp.status_code == 200
    info = resp.json()["info"]
    assert info["is_active"] is True
    assert info["schedule"] == schedule

    eu = ExerciseUser.objects.get(user=user, exercise=fitness[3])
    assert eu.schedule == schedule


def test_log_set_creates_workout_and_data(authenticated_client, fitness):

    user, client = authenticated_client()
    exercise = fitness[3]  # Push Ups — no workouts in the fixture

    assert Workout.objects.filter(user=user, exercise=exercise).count() == 0

    url = urls.reverse("fitness:log_set", kwargs={"exercise_uuid": exercise.uuid})
    resp = client.post(url, {"weight": "0", "reps": "12", "duration": "0"})

    assert resp.status_code == 200
    payload = resp.json()["set"]
    assert payload["reps"] == 12
    assert payload["index"] == 1

    # Exactly one Workout now exists, containing the new set.
    assert Workout.objects.filter(user=user, exercise=exercise).count() == 1
    assert Data.objects.filter(pk=payload["id"]).exists()


def test_log_set_appends_to_existing_today_workout(authenticated_client, fitness):

    user, client = authenticated_client()
    exercise = fitness[3]

    url = urls.reverse("fitness:log_set", kwargs={"exercise_uuid": exercise.uuid})
    first = client.post(url, {"reps": "10"}).json()["set"]
    second = client.post(url, {"reps": "8"}).json()["set"]

    assert first["index"] == 1
    assert second["index"] == 2

    data_first = Data.objects.get(pk=first["id"])
    data_second = Data.objects.get(pk=second["id"])
    assert data_first.workout_id == data_second.workout_id
    assert Workout.objects.filter(user=user, exercise=exercise).count() == 1


def test_log_set_requires_reps(authenticated_client, fitness):

    _, client = authenticated_client()
    url = urls.reverse("fitness:log_set", kwargs={"exercise_uuid": fitness[0].uuid})

    resp = client.post(url, {"weight": "25"})
    assert resp.status_code == 400


def test_delete_set_removes_single_row(authenticated_client, fitness):

    user, client = authenticated_client()
    exercise = fitness[0]

    workout = Workout.objects.filter(user=user, exercise=exercise).first()
    assert workout is not None
    set_rows = list(workout.data_set.all())
    assert len(set_rows) >= 2

    url = urls.reverse("fitness:delete_set")
    resp = client.post(url, {"id": set_rows[0].pk})

    assert resp.status_code == 200
    assert resp.json()["workout_deleted"] is False
    assert not Data.objects.filter(pk=set_rows[0].pk).exists()
    assert Workout.objects.filter(pk=workout.pk).exists()


def test_delete_set_cascades_empty_workout(authenticated_client, fitness):

    user, client = authenticated_client()
    exercise = fitness[0]

    # Create an isolated workout with a single set so we can watch it vanish.
    solo_workout = Workout.objects.create(user=user, exercise=exercise)
    solo_data = Data.objects.create(workout=solo_workout, weight=100, reps=5)

    url = urls.reverse("fitness:delete_set")
    resp = client.post(url, {"id": solo_data.pk})

    assert resp.status_code == 200
    assert resp.json()["workout_deleted"] is True
    assert not Workout.objects.filter(pk=solo_workout.pk).exists()


def test_delete_set_rejects_other_users_data(authenticated_client, fitness):

    _, client = authenticated_client()

    other_user = User.objects.create(username="intruder-target")
    other_workout = Workout.objects.create(user=other_user, exercise=fitness[0])
    other_data = Data.objects.create(workout=other_workout, weight=100, reps=5)

    url = urls.reverse("fitness:delete_set")
    resp = client.post(url, {"id": other_data.pk})

    assert resp.status_code == 404
    assert Data.objects.filter(pk=other_data.pk).exists()


def test_fitness_swap_active_exercise(authenticated_client, fitness):

    user, client = authenticated_client()

    # Put fitness[0] on the active list with a custom schedule; fitness[3]
    # (Push Ups) starts inactive.
    source_schedule = [True, False, True, False, True, False, False]
    ExerciseUser.objects.filter(user=user, exercise=fitness[0]).update(
        schedule=source_schedule, rest_period=4
    )
    assert not ExerciseUser.objects.filter(user=user, exercise=fitness[3]).exists()

    url = urls.reverse("fitness:swap_active_exercise")
    resp = client.post(url, {
        "from_uuid": str(fitness[0].uuid),
        "to_uuid": str(fitness[3].uuid),
    })

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["info"]["is_active"] is True
    assert payload["info"]["schedule"] == source_schedule
    assert str(fitness[3].uuid) in payload["to_url"]

    # Source is off, target is on and carries the schedule/rest period.
    assert not ExerciseUser.objects.filter(user=user, exercise=fitness[0]).exists()
    target_eu = ExerciseUser.objects.get(user=user, exercise=fitness[3])
    assert target_eu.schedule == source_schedule
    assert target_eu.rest_period == 4


def test_fitness_swap_rejects_inactive_source(authenticated_client, fitness):

    _, client = authenticated_client()

    # fitness[3] has no ExerciseUser row → cannot be swapped from.
    url = urls.reverse("fitness:swap_active_exercise")
    resp = client.post(url, {
        "from_uuid": str(fitness[3].uuid),
        "to_uuid": str(fitness[0].uuid),
    })

    assert resp.status_code == 404


def test_fitness_update_rest_period(authenticated_client, fitness):

    user, client = authenticated_client()

    rest_period = 5

    url = urls.reverse("fitness:update_rest_period")
    resp = client.post(url, {
        "uuid": fitness[0].uuid,
        "rest_period": str(rest_period)
    })

    assert resp.status_code == 200

    updated_exercise_user = ExerciseUser.objects.get(user=user, exercise__uuid=fitness[0].uuid)
    assert updated_exercise_user.rest_period == rest_period
