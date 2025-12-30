"""Views for managing Reminder objects.

This module provides class-based views for CRUD operations on reminders,
including a specialized AJAX view for dynamic list updates. All views
require authentication and automatically filter to the current user's reminders.
"""

from typing import Any, Dict, cast

from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.db.models.query import QuerySet
from django.forms import BaseModelForm
from django.http import HttpResponse, JsonResponse
from django.urls import reverse, reverse_lazy
from django.utils import dateformat
from django.views.generic import (CreateView, DeleteView, DetailView, ListView,
                                  TemplateView, UpdateView)

from .forms import ReminderForm
from .models import Reminder


class ReminderAppView(LoginRequiredMixin, TemplateView):
    """Display the main reminders page.

    This view renders the reminder app shell page, which uses React to load
    and display the reminder list via AJAX. The page includes auto-refresh
    functionality to keep the list current.
    """

    template_name = "reminder/index.html"

    def get_context_data(self, **kwargs: Any) -> Dict[str, Any]:
        """Add title to the template context.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - title: Page title "Reminders"
        """
        context = super().get_context_data(**kwargs)
        context["title"] = "Reminders"
        return context


class ReminderDetailView(LoginRequiredMixin, DetailView):
    """Display details of a single reminder.

    Shows full details for one reminder, including its schedule, status,
    and trigger times. Access is limited to the reminder's owner.
    """

    model = Reminder
    template_name = "reminder/detail.html"
    context_object_name = "reminder"
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def get_queryset(self) -> QuerySet[Reminder]:
        """Limit queryset to current user's reminders only.

        Returns:
            QuerySet filtered to reminders owned by the authenticated user.
        """
        user = cast(User, self.request.user)
        return Reminder.objects.filter(user=user)


class ReminderCreateView(LoginRequiredMixin, CreateView):
    """Create a new reminder.

    Handles creation of new reminder objects, automatically associating them
    with the current user and calculating the initial next_trigger_at based
    on the start_at time if provided.
    """

    model = Reminder
    form_class = ReminderForm
    template_name = "reminder/form.html"
    success_url = reverse_lazy("reminder:app")

    def form_valid(self, form: BaseModelForm) -> HttpResponse:
        """Set the user and calculate next_trigger_at before saving.

        Args:
            form: The validated form containing reminder data.

        Returns:
            HttpResponse redirecting to the success URL.
        """
        form.instance.user = self.request.user
        # Calculate next_trigger_at if start_at is set
        if form.instance.start_at:
            form.instance.next_trigger_at = form.instance.start_at
        return super().form_valid(form)


class ReminderUpdateView(LoginRequiredMixin, UpdateView):
    """Update an existing reminder.

    Allows editing of reminder properties. Automatically recalculates
    next_trigger_at if start_at is modified and next_trigger_at is not set.
    Access is limited to the reminder's owner.
    """

    model = Reminder
    form_class = ReminderForm
    template_name = "reminder/form.html"
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    success_url = reverse_lazy("reminder:app")

    def form_valid(self, form: BaseModelForm) -> HttpResponse:
        """Calculate next_trigger_at if start_at is set and next_trigger_at is empty.

        Args:
            form: The validated form containing updated reminder data.

        Returns:
            HttpResponse redirecting to the success URL.
        """
        # If start_at is set and next_trigger_at is not, calculate it
        if form.instance.start_at and not form.instance.next_trigger_at:
            form.instance.next_trigger_at = form.instance.start_at
        return super().form_valid(form)

    def get_queryset(self) -> QuerySet[Reminder]:
        """Limit queryset to current user's reminders only.

        Returns:
            QuerySet filtered to reminders owned by the authenticated user.
        """
        user = cast(User, self.request.user)
        return Reminder.objects.filter(user=user)


class ReminderDeleteView(LoginRequiredMixin, DeleteView):
    """Delete a reminder.

    Handles deletion of reminder objects with confirmation. Access is limited
    to the reminder's owner to prevent unauthorized deletion.
    """

    model = Reminder
    template_name = "reminder/confirm_delete.html"
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    success_url = reverse_lazy("reminder:app")

    def get_queryset(self) -> QuerySet[Reminder]:
        """Limit queryset to current user's reminders only.

        Returns:
            QuerySet filtered to reminders owned by the authenticated user.
        """
        user = cast(User, self.request.user)
        return Reminder.objects.filter(user=user)


class ReminderListAjaxView(LoginRequiredMixin, ListView):
    """Serve reminders list as JSON for AJAX requests.

    This view provides reminder data in JSON format, allowing the client
    to handle rendering. Includes pagination information for client-side
    pagination controls.
    """

    model = Reminder
    context_object_name = "reminders"
    paginate_by = 20

    def get_queryset(self) -> QuerySet[Reminder]:
        """Get reminders for the current user, ordered by next trigger time.

        Returns:
            QuerySet of Reminder objects filtered by the logged-in user,
            ordered by next_trigger_at ascending (soonest first), then by
            created descending.
        """
        user = cast(User, self.request.user)
        return Reminder.objects.filter(user=user).order_by(
            "next_trigger_at", "-created"
        )

    def render_to_response(
        self, context: Dict[str, Any], **response_kwargs: Any
    ) -> JsonResponse:
        """Return reminder data as JSON.

        Args:
            context: Template context dictionary containing reminders and pagination data.
            **response_kwargs: Additional keyword arguments for the response.

        Returns:
            JsonResponse containing reminders list and pagination metadata.
        """
        reminders_data = [
            {
                "uuid": str(reminder.uuid),
                "name": reminder.name,
                "note": reminder.note or "",
                "is_active": reminder.is_active,
                "interval_value": reminder.interval_value,
                "interval_unit_display": reminder.get_interval_unit_display().lower(),
                "next_trigger_at": dateformat.format(reminder.next_trigger_at, "M d, g:i A") if reminder.next_trigger_at else None,
                "next_trigger_at_unix": int(dateformat.format(reminder.next_trigger_at, "U")) if reminder.next_trigger_at else None,
                "detail_url": reverse("reminder:detail", kwargs={"uuid": reminder.uuid}),
                "update_url": reverse("reminder:update", kwargs={"uuid": reminder.uuid}),
                "delete_url": reverse("reminder:delete", kwargs={"uuid": reminder.uuid}),
            }
            for reminder in context["reminders"]
        ]

        page_obj = context.get("page_obj")
        return JsonResponse({
            "reminders": reminders_data,
            "pagination": {
                "current_page": page_obj.number if page_obj else 1,
                "total_pages": page_obj.paginator.num_pages if page_obj else 1,
                "total_count": page_obj.paginator.count if page_obj else len(reminders_data),
                "has_previous": page_obj.has_previous() if page_obj else False,
                "has_next": page_obj.has_next() if page_obj else False,
                "previous_page_number": page_obj.previous_page_number() if page_obj and page_obj.has_previous() else None,
                "next_page_number": page_obj.next_page_number() if page_obj and page_obj.has_next() else None,
            },
        })
