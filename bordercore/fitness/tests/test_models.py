import pytest

from fitness.models import Exercise, ExerciseMuscle, ExerciseUser, Muscle
from fitness.services import get_overdue_exercises

pytestmark = pytest.mark.django_db


def test_fitness_str(auto_login_user, fitness):

    user, _ = auto_login_user()

    assert str(fitness[0]) == "Bench Press"
    assert "Pectoralis Major" in [str(x) for x in fitness[0].muscle.all()]
    assert "Chest" in [str(x.muscle_group) for x in fitness[0].muscle.all()]
    assert str(ExerciseUser.objects.get(user=user, exercise=fitness[2])) == "Exercise 'Squats' for user testuser"
    assert str(ExerciseMuscle.objects.get(
        exercise=fitness[0],
        muscle=fitness[0].muscle.first()
    )) == "ExerciseMuscle: Bench Press, Pectoralis Major"


def test_get_targeted_muscles(auto_login_user, fitness):

    muscles = fitness[0].get_targeted_muscles()
    assert "primary" in [x for x in muscles]
    assert len(muscles) == 1

    muscle = Muscle.objects.get(name="Pectoralis Major")
    assert muscle in muscles.pop("primary")


def test_last_workout(auto_login_user, fitness):

    user, _ = auto_login_user()

    workout = fitness[0].last_workout(user)

    assert workout["latest_reps"] == [8, 8, 8, 8]
    assert workout["latest_duration"] == [0, 0, 0, 0]
    assert workout["latest_weight"] == [200.0, 205.0, 210.0, 220.0]
    assert workout["delta_days"] == 1


def test_get_plot_data(auto_login_user, fitness):

    user, _ = auto_login_user()

    plot_data = fitness[0].get_plot_info()
    reps = plot_data["plot_data"]["reps"]
    weight = plot_data["plot_data"]["weight"]
    paginator = plot_data["paginator"]

    assert len(plot_data["labels"]) == 11
    assert len(reps) == 11
    assert len(weight) == 11
    assert plot_data["initial_plot_type"] == "weight"
    assert paginator["page_number"] == 1
    assert paginator["has_previous"] is False
    assert paginator["has_next"] is False
    assert paginator["previous_page_number"] is None
    assert paginator["next_page_number"] is None

    plot_data = fitness[0].get_plot_info(count=4)
    reps = plot_data["plot_data"]["reps"]
    weight = plot_data["plot_data"]["weight"]
    paginator = plot_data["paginator"]

    assert len(plot_data["labels"]) == 4
    assert len(reps) == 4
    assert len(weight) == 4
    assert plot_data["initial_plot_type"] == "weight"
    assert paginator["page_number"] == 1
    assert paginator["has_previous"] is True
    assert paginator["has_next"] is False
    assert paginator["previous_page_number"] == 2
    assert paginator["next_page_number"] is None

    plot_data = fitness[4].get_plot_info(count=4, page_number=2)
    reps = plot_data["plot_data"]["reps"]
    duration = plot_data["plot_data"]["duration"]
    paginator = plot_data["paginator"]

    assert len(plot_data["labels"]) == 4
    assert len(reps) == 4
    assert len(duration) == 4
    assert plot_data["initial_plot_type"] == "duration"
    assert paginator["page_number"] == 2
    assert paginator["has_previous"] is True
    assert paginator["has_next"] is True
    assert paginator["previous_page_number"] == 3
    assert paginator["next_page_number"] == 1


def test_get_related_exercises(auto_login_user, fitness):

    exercise = Exercise.objects.get(name="Push Ups")
    related_exercises = fitness[0].get_related_exercises()

    assert len(related_exercises) == 1
    assert exercise in related_exercises


def test_get_overdue_exercises(auto_login_user, fitness):

    user, _ = auto_login_user()

    overdue = get_overdue_exercises(user)

    assert overdue[0] == fitness[2]
    assert overdue[0].delta_days == 10

    overdue = get_overdue_exercises(user, True)
    assert overdue == 1


def test_schedule_days():

    assert ExerciseUser.schedule_days(None) == ""

    assert ExerciseUser.schedule_days([False, False, True, False, False, False, False, ]) == "Wed"

    assert ExerciseUser.schedule_days([True, False, False, True, False, False, False, ]) == "Mon, Thu"
