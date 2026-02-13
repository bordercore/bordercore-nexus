"""Django admin configuration for the Fitness app."""

from django.contrib import admin

from fitness.models import (Data, Exercise, ExerciseMuscle, ExerciseUser,
                            Muscle, MuscleGroup)

admin.site.register(Data)
admin.site.register(Exercise)
admin.site.register(ExerciseUser)
admin.site.register(Muscle)
admin.site.register(MuscleGroup)
admin.site.register(ExerciseMuscle)
