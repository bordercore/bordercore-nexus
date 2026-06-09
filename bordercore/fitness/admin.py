"""Django admin configuration for the Fitness app."""

from django.contrib import admin

from fitness.models import (Data, Exercise, ExerciseMuscle, ExerciseUser,
                            Muscle, MuscleGroup, Workout)


@admin.register(MuscleGroup)
class MuscleGroupAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Muscle)
class MuscleAdmin(admin.ModelAdmin):
    list_display = ("name", "muscle_group")
    list_select_related = ("muscle_group",)
    list_filter = ("muscle_group",)
    search_fields = ("name",)


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ("name", "has_duration", "has_weight")
    list_filter = ("has_duration", "has_weight")
    search_fields = ("name",)


@admin.register(ExerciseMuscle)
class ExerciseMuscleAdmin(admin.ModelAdmin):
    list_display = ("exercise", "muscle", "target")
    list_select_related = ("exercise", "muscle")
    list_filter = ("target",)
    raw_id_fields = ("exercise", "muscle")
    search_fields = ("exercise__name", "muscle__name")


@admin.register(Workout)
class WorkoutAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "exercise", "date")
    list_select_related = ("user", "exercise")
    raw_id_fields = ("user", "exercise")
    search_fields = ("exercise__name", "user__username")
    date_hierarchy = "date"


@admin.register(Data)
class DataAdmin(admin.ModelAdmin):
    list_display = ("id", "workout", "date", "reps", "weight", "duration")
    list_select_related = ("workout", "workout__exercise")
    raw_id_fields = ("workout",)
    search_fields = ("workout__exercise__name",)
    date_hierarchy = "date"


@admin.register(ExerciseUser)
class ExerciseUserAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "exercise", "rest_period", "started")
    list_select_related = ("user", "exercise")
    raw_id_fields = ("user", "exercise")
    search_fields = ("exercise__name", "user__username")
