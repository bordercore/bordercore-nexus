import json

import pytest
from faker import Factory as FakerFactory

from django import urls

from fitness.models import Exercise, ExerciseUser

pytestmark = [pytest.mark.django_db]

faker = FakerFactory.create()


def test_fitness_exercise_detail(auto_login_user, fitness):

    _, client = auto_login_user()

    url = urls.reverse("fitness:exercise_detail", kwargs={"uuid": fitness[0].uuid})
    resp = client.get(url)

    assert resp.status_code == 200

    # Test an inactive exercise

    url = urls.reverse("fitness:exercise_detail", kwargs={"uuid": fitness[1].uuid})
    resp = client.get(url)

    assert resp.status_code == 200


def test_fitness_add(auto_login_user, fitness):

    _, client = auto_login_user()

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


def test_fitness_summary(auto_login_user, fitness):

    _, client = auto_login_user()

    url = urls.reverse("fitness:summary")
    resp = client.get(url)

    assert resp.status_code == 200


def test_fitness_change_active_status(auto_login_user, fitness):

    user, client = auto_login_user()

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


def test_edit_note(auto_login_user, fitness):

    _, client = auto_login_user()

    note = faker.text()

    url = urls.reverse("fitness:edit_note")
    resp = client.post(url, {
        "uuid": fitness[0].uuid,
        "note": note
    })

    assert resp.status_code == 200

    updated_exercise = Exercise.objects.get(uuid=fitness[0].uuid)
    assert updated_exercise.note == note


def test_fitness_get_workout_data(auto_login_user, fitness):

    _, client = auto_login_user()

    url = urls.reverse("fitness:get_workout_data")
    resp = client.get(f"{url}?uuid={fitness[0].uuid}")

    result = resp.json()
    assert resp.status_code == 200
    assert result["status"] == "OK"
    assert len(result["workout_data"]["labels"]) == 11
    assert len(result["workout_data"]["plot_data"]["reps"]) == 11
    assert len(result["workout_data"]["plot_data"]["reps"][0]) == 4
    assert result["workout_data"]["initial_plot_type"] == "weight"
    assert result["workout_data"]["paginator"]["page_number"] == 1


def test_fitness_update_schedule(auto_login_user, fitness):

    user, client = auto_login_user()

    schedule = [False, True, False, False, False, True, False]

    url = urls.reverse("fitness:update_schedule")
    resp = client.post(url, {
        "uuid": fitness[0].uuid,
        "schedule": ",".join([str(x).lower() for x in schedule])
    })

    assert resp.status_code == 200

    updated_exercise_user = ExerciseUser.objects.get(user=user, exercise__uuid=fitness[0].uuid)
    assert updated_exercise_user.schedule == schedule


def test_fitness_update_rest_period(auto_login_user, fitness):

    user, client = auto_login_user()

    rest_period = 5

    url = urls.reverse("fitness:update_rest_period")
    resp = client.post(url, {
        "uuid": fitness[0].uuid,
        "rest_period": str(rest_period)
    })

    assert resp.status_code == 200

    updated_exercise_user = ExerciseUser.objects.get(user=user, exercise__uuid=fitness[0].uuid)
    assert updated_exercise_user.rest_period == rest_period
