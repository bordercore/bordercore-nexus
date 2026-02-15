import datetime
from datetime import timedelta

import pytest

from fitness.models import Exercise, ExerciseUser, Muscle, MuscleGroup, Data, Workout


@pytest.fixture
def fitness(authenticated_client):

    user, _ = authenticated_client()

    muscle_group = MuscleGroup.objects.create(name="Chest")
    muscle = Muscle.objects.create(name="Pectoralis Major", muscle_group=muscle_group)
    note = "### Trying to make some **gains**"
    exercise_0 = Exercise.objects.create(name="Bench Press", note=note)
    exercise_0.muscle.add(muscle)
    ExerciseUser.objects.create(
        user=user,
        exercise=exercise_0,
        started=datetime.datetime.now(),
        schedule=[True, False, False, False, False, False, False]
    )

    # Generate a bunch of workouts for one exercise, helpful for
    #  testing pagination
    for i in range(10):
        workout = Workout.objects.create(user=user, exercise=exercise_0)
        Data.objects.create(workout=workout, weight=210, reps=10)
        Data.objects.create(workout=workout, weight=210, reps=10)
        Data.objects.create(workout=workout, weight=210, reps=10)
        Data.objects.create(workout=workout, weight=210, reps=10)

    workout = Workout.objects.create(user=user, exercise=exercise_0)
    Data.objects.create(workout=workout, weight=200, reps=8)
    Data.objects.create(workout=workout, weight=205, reps=8)
    Data.objects.create(workout=workout, weight=210, reps=8)
    Data.objects.create(workout=workout, weight=220, reps=8)

    muscle_group = MuscleGroup.objects.create(name="Back")
    muscle = Muscle.objects.create(name="Latissimus Dorsi", muscle_group=muscle_group)
    exercise_1 = Exercise.objects.create(name="Pull Ups")
    exercise_1.muscle.add(muscle)
    workout = Workout.objects.create(user=user, exercise=exercise_1)
    Data.objects.create(workout=workout, duration=0, weight=0, reps=12)
    Data.objects.create(workout=workout, duration=0, weight=0, reps=11)
    Data.objects.create(workout=workout, duration=0, weight=0, reps=8)

    muscle_group = MuscleGroup.objects.create(name="Legs")
    muscle = Muscle.objects.create(name="Glutes", muscle_group=muscle_group)
    exercise_2 = Exercise.objects.create(name="Squats")
    exercise_2.muscle.add(muscle)

    ExerciseUser.objects.create(
        user=user,
        exercise=exercise_2,
        schedule=[True, False, False, False, False, False, False]
    )
    workout = Workout.objects.create(user=user, exercise=exercise_2)

    # Force this exercise to be overdue
    data = Data.objects.create(workout=workout, weight=200, reps=8)
    data.date = data.date - timedelta(days=10)
    data.save()

    # Force this exercise to be overdue
    data = Data.objects.create(workout=workout, weight=205, reps=8)
    data.date = data.date - timedelta(days=10)
    data.save()

    # Add a related exercise to exercise_0
    exercise_3 = Exercise.objects.create(name="Push Ups", note=note)
    muscle = Muscle.objects.get(name="Pectoralis Major")
    exercise_3.muscle.add(muscle)

    # Add an exercise with a duration
    muscle_group = MuscleGroup.objects.get(name="Back")
    muscle = Muscle.objects.get(name="Latissimus Dorsi", muscle_group=muscle_group)
    exercise_4 = Exercise.objects.create(name="Dead Hang")
    exercise_4.muscle.add(muscle)
    for i in range(10):
        workout = Workout.objects.create(user=user, exercise=exercise_4)
        Data.objects.create(workout=workout, duration=105, weight=0, reps=1)
        Data.objects.create(workout=workout, duration=105, weight=0, reps=1)
        Data.objects.create(workout=workout, duration=105, weight=0, reps=1)
        Data.objects.create(workout=workout, duration=105, weight=0, reps=1)

    yield [exercise_0, exercise_1, exercise_2, exercise_3, exercise_4]
