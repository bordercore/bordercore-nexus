from django.urls import path

from . import views

app_name = "quantified_self"
urlpatterns = [
    path("", views.index, name="index"),
    path("sleep/summary/", views.sleep_summary, name="sleep_summary"),
    path("sleep/night/", views.sleep_night, name="sleep_night"),
    path("summary/", views.summary, name="summary"),
    path("nights/review/", views.review_nights, name="review"),
    path("imports/", views.import_history, name="imports"),
    path("imports/progress/<uuid:uuid>/", views.import_status, name="import_status"),
    path("imports/<uuid:uuid>/commit/", views.import_commit, name="import_commit"),
    path("<str:kind>/import/", views.import_preview, name="import_preview"),
    path("<str:kind>/export/", views.download, name="export"),
    path("<str:kind>/records/", views.records, name="records"),
    path("<str:kind>/records/<uuid:uuid>/", views.record_detail, name="record_detail"),
]
