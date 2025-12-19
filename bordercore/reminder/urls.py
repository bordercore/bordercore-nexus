from django.urls import path

from . import views

app_name = "reminder"

urlpatterns = [
    path("", views.ReminderAppView.as_view(), name="app"),
    path("ajax/list/", views.ReminderListAjaxView.as_view(), name="list-ajax"),
    path("create/", views.ReminderCreateView.as_view(), name="create"),
    path("<uuid:uuid>/", views.ReminderDetailView.as_view(), name="detail"),
    path("<uuid:uuid>/edit/", views.ReminderUpdateView.as_view(), name="update"),
    path("<uuid:uuid>/delete/", views.ReminderDeleteView.as_view(), name="delete"),
]
