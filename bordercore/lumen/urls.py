from django.urls import path

from . import views

app_name = "lumen"
urlpatterns = [
    path("", views.index, name="index"),
    path("api/lessons/", views.library, name="library"),
    path(
        "api/questions/<uuid:question_uuid>/versions/", views.versions, name="versions"
    ),
    path("api/lessons/<uuid:lesson_id>/", views.detail, name="detail"),
    path("lessons/<uuid:lesson_id>/html/", views.lesson_html, name="html"),
    path(
        "api/lessons/<uuid:lesson_id>/check-accuracy/",
        views.check_accuracy,
        name="check_accuracy",
    ),
    path(
        "api/lessons/<uuid:lesson_id>/correct-source/",
        views.correct_source,
        name="correct_source",
    ),
    path("api/preferences/", views.preferences, name="preferences"),
    path("api/models/<str:provider>/", views.models, name="models"),
    path("api/generate/", views.generate, name="generate"),
    path("api/jobs/", views.jobs, name="jobs"),
    path("api/jobs/<uuid:job_id>/", views.job_status, name="job"),
]
