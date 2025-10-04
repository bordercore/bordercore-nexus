import datetime
import json
import uuid
from collections import defaultdict
from datetime import timedelta

from django.contrib.auth.models import User
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields.array import ArrayField
from django.core.paginator import Paginator
from django.db import models
from django.db.models import F, Max

from lib.time_utils import get_relative_date_from_date


class MuscleGroup(models.Model):
    name = models.TextField(unique=True)

    def __str__(self):
        return self.name


class Muscle(models.Model):
    name = models.TextField(unique=True)
    muscle_group = models.ForeignKey(MuscleGroup, on_delete=models.PROTECT)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name"]


class Exercise(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    name = models.TextField(unique=True)
    muscle = models.ManyToManyField(Muscle, through="ExerciseMuscle", related_name="muscle")
    description = models.TextField(blank=True)
    note = models.TextField(blank=True)
    has_duration = models.BooleanField(default=True)
    has_weight = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name"]

    def get_targeted_muscles(self):

        muscles = defaultdict(list)

        for x in ExerciseMuscle.objects.filter(exercise=self).select_related("muscle"):
            muscles[x.target].append(x.muscle)

        return muscles

    def last_workout(self, user):

        workout = Workout.objects.filter(
            user=user,
            exercise__id=self.id
        ).order_by(
            "-date"
        ).first()

        if not workout:
            return {
                "latest_duration": [],
                "latest_reps": [],
                "latest_weight": [],
            }

        recent_data = workout.data_set.all()

        info = {
            "recent_data": recent_data,
            "latest_reps": [x.reps or 0 for x in recent_data],
            "latest_weight": [x.weight or 0 for x in recent_data],
            "latest_duration": [x.duration or 0 for x in recent_data],
            "delta_days": int((int(datetime.datetime.now().strftime("%s")) - int(recent_data[0].date.strftime("%s"))) / 86400) + 1,
        }

        return info

    def get_plot_data(self, count=12, page_number=1):

        raw_data = Workout.objects.filter(exercise__id=self.id) \
                                  .annotate(reps=ArrayAgg("data__reps", order_by="-date")) \
                                  .annotate(weight=ArrayAgg("data__weight", order_by="-date")) \
                                  .annotate(duration=ArrayAgg("data__duration", order_by="-date")) \
                                  .order_by("-date")

        p = Paginator(raw_data, count).page(page_number)

        raw_data = p.object_list

        initial_plot_type = "reps"
        plotdata = {}
        plotdata["reps"] = [x.reps for x in raw_data][::-1]
        if [x.weight for x in raw_data if x.weight and x.weight[0] > 0]:
            plotdata["weight"] = [x.weight for x in raw_data][::-1]
            initial_plot_type = "weight"
        elif [x.duration for x in raw_data if x.duration and x.duration[0] > 0]:
            plotdata["duration"] = [x.duration for x in raw_data][::-1]
            initial_plot_type = "duration"
        labels = [x.date.strftime("%b %d") for x in raw_data]
        notes = [x.note for x in raw_data]

        return {
            "labels": json.dumps(labels[::-1]),
            "plotdata": json.dumps(plotdata),
            "notes": notes[::-1],
            "initial_plot_type": initial_plot_type,
            "paginator": json.dumps({
                "page_number": page_number,
                "has_previous": p.has_next(),
                "has_next": p.has_previous(),
                "previous_page_number": p.next_page_number() if p.has_next() else None,
                "next_page_number": p.previous_page_number() if p.has_previous() else None,
            })
        }

    def get_related_exercises(self):
        """
        Get a list of related exercises, based on muscles targeted
        """

        return Exercise.objects.annotate(
            last_active=Max("workout__data__date")
        ).filter(
            muscle__in=self.muscle.all()
        ).exclude(
            id=self.id
        ).distinct().order_by(F("last_active").desc(nulls_last=True))


class ExerciseMuscle(models.Model):

    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    muscle = models.ForeignKey(Muscle, on_delete=models.CASCADE)
    note = models.TextField(blank=True, null=True)

    WEIGHTS = [
        ("primary", "primary"),
        ("secondary", "secondary"),
    ]

    target = models.CharField(
        max_length=20,
        choices=WEIGHTS,
        default="primary",
    )

    def __str__(self):
        return f"ExerciseMuscle: {self.exercise}, {self.muscle}"

    class Meta:
        unique_together = (
            ("exercise", "muscle")
        )


class Workout(models.Model):
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT)
    date = models.DateTimeField(auto_now_add=True)
    note = models.TextField(blank=True, null=True)


class Data(models.Model):
    workout = models.ForeignKey(Workout, on_delete=models.PROTECT)
    date = models.DateTimeField(auto_now_add=True)
    weight = models.FloatField(blank=True, null=True)
    reps = models.PositiveIntegerField()
    duration = models.PositiveIntegerField(blank=True, null=True)

    class Meta:
        verbose_name_plural = "Data"


class ExerciseUser(models.Model):
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT)
    started = models.DateTimeField(auto_now_add=True)
    frequency = models.DurationField(default=timedelta(days=7), blank=False, null=False)
    rest_period = models.FloatField(blank=True, null=True)
    schedule = ArrayField(models.BooleanField(blank=True, null=True), size=7)

    class Meta:
        unique_together = ("user", "exercise")

    def __str__(self):
        return self.exercise.name

    def activity_info(self):
        return {
            "frequency": self.frequency.days,
            "schedule": self.schedule,
            "relative_date": get_relative_date_from_date(self.started),
            "started": self.started.strftime("%b %d, %Y")
        }

    @staticmethod
    def schedule_days(schedule):

        if not schedule:
            return ""

        days = []

        # We'll start from a known Monday. Let's choose 2023-01-02, which was a Monday.
        start_date = datetime.datetime(2023, 1, 2)

        for index, day in enumerate(schedule):
            if day:
                target_date = start_date + timedelta(days=index)
                days.append(target_date.strftime("%a"))

        return ", ".join(days)
