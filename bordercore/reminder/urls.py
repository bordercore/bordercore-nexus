from django.urls import path

from . import views

app_name = "reminder"

urlpatterns = [
    path("", views.ReminderAppView.as_view(), name="app"),
    path("ajax/list/", views.ReminderListAjaxView.as_view(), name="list-ajax"),
    path("ajax/detail/<uuid:uuid>/", views.ReminderDetailAjaxView.as_view(), name="detail-ajax"),
    path("ajax/form/<uuid:uuid>/", views.ReminderFormAjaxView.as_view(), name="form-ajax"),
    path("create/", views.ReminderCreateView.as_view(), name="create"),
    path("<uuid:uuid>/", views.ReminderDetailView.as_view(), name="detail"),
    path("<uuid:uuid>/edit/", views.ReminderUpdateView.as_view(), name="update"),
    path("<uuid:uuid>/delete/", views.ReminderDeleteView.as_view(), name="delete"),
]
