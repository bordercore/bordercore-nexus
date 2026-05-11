"""Views for managing Reminder objects.

This module provides class-based views for CRUD operations on reminders,
including a specialized AJAX view for dynamic list updates. All views
require authentication and automatically filter to the current user's reminders.
"""

from datetime import datetime
from typing import Any, cast

from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from rest_framework.request import Request

from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import dateformat, timezone
from django.views.generic import DetailView, TemplateView

from lib.mixins import UserScopedQuerysetMixin

from .forms import ReminderForm
from .models import Reminder


class ReminderAppView(LoginRequiredMixin, TemplateView):
    """Display the main reminders page.

    This view renders the reminder app shell page, which uses React to load
    and display the reminder list via AJAX. The page includes auto-refresh
    functionality to keep the list current.
    """

    template_name = "reminder/index.html"

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
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


class ReminderDetailView(LoginRequiredMixin, UserScopedQuerysetMixin, DetailView):
    """Display details of a single reminder.

    Shows full details for one reminder, including its schedule, status,
    and trigger times. Access is limited to the reminder's owner.
    """

    model = Reminder
    template_name = "reminder/detail.html"
    context_object_name = "reminder"
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Add detail-ajax URL to context.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary with reminder details URLs.
        """
        context = super().get_context_data(**kwargs)
        context["title"] = f"{self.object.name} - Reminder"
        context["detail_ajax_url"] = reverse(
            "reminder:detail-ajax", kwargs={"uuid": self.object.uuid}
        )
        return context


class ReminderDetailAjaxView(APIView):
    """Serve reminder detail as JSON for AJAX requests.

    This view provides a single reminder's data in JSON format, allowing the client
    to handle rendering.
    """

    def get(self, request: Request, uuid: str) -> Response:
        """Return reminder data as JSON.

        Args:
            request: The HTTP request object.
            uuid: UUID of the reminder to retrieve.

        Returns:
            Response containing reminder data.
        """
        user = cast(User, request.user)
        reminder = get_object_or_404(Reminder, uuid=uuid, user=user)

        def format_time_with_ampm(dt: datetime | None) -> str | None:
            """Format datetime as 'M d, Y 8pm' or 'M d, Y 3:30am'."""
            if not dt:
                return None
            local_dt = timezone.localtime(dt)
            formatted = dateformat.format(local_dt, "M d, Y g:i a")
            formatted = formatted.replace(" :00 ", " ").replace(" :00", "").replace(" am", "am").replace(" pm", "pm")
            return formatted

        data = {
            "uuid": str(reminder.uuid),
            "name": reminder.name,
            "note": reminder.note or "",
            "is_active": reminder.is_active,
            # New schedule fields
            "schedule_type": reminder.schedule_type,
            "schedule_type_display": reminder.get_schedule_type_display(),
            "schedule_description": reminder.get_schedule_description(),
            "trigger_time": reminder.trigger_time.strftime("%I:%M %p").lstrip("0") if reminder.trigger_time else None,
            "days_of_week": reminder.days_of_week,
            "days_of_week_display": reminder.get_days_of_week_display(),
            "days_of_month": reminder.days_of_month,
            # Legacy fields (for backward compatibility)
            "interval_value": reminder.interval_value,
            "interval_unit_display": reminder.get_interval_unit_display().lower(),
            # Timestamps
            "next_trigger_at": format_time_with_ampm(reminder.next_trigger_at),
            "last_triggered_at": format_time_with_ampm(reminder.last_triggered_at),
            "start_at": format_time_with_ampm(reminder.start_at),
            "created": format_time_with_ampm(reminder.created),
            "updated": format_time_with_ampm(reminder.modified),
            # URLs
            "update_url": reverse("reminder:update", kwargs={"uuid": reminder.uuid}),
            "delete_url": reverse("reminder:delete", kwargs={"uuid": reminder.uuid}),
            "app_url": reverse("reminder:app"),
        }
        return Response(data)


class ReminderFormAjaxView(APIView):
    """Serve reminder form data as JSON for AJAX requests (edit mode).

    This view provides a single reminder's data in JSON format for populating
    the edit form.
    """

    def get(self, request: Request, uuid: str) -> Response:
        """Return reminder form data as JSON.

        Args:
            request: The HTTP request object.
            uuid: UUID of the reminder to retrieve.

        Returns:
            Response containing reminder form data.
        """
        user = cast(User, request.user)
        reminder = get_object_or_404(Reminder, uuid=uuid, user=user)
        # Format start_at for datetime-local input (ISO format)
        start_at_iso = reminder.start_at.isoformat() if reminder.start_at else None
        # Format trigger_time for time input (HH:MM format)
        trigger_time_str = reminder.trigger_time.strftime("%H:%M") if reminder.trigger_time else ""
        data = {
            "name": reminder.name,
            "note": reminder.note or "",
            "is_active": reminder.is_active,
            "create_todo": reminder.create_todo,
            "start_at": start_at_iso,
            # New schedule fields
            "schedule_type": reminder.schedule_type,
            "trigger_time": trigger_time_str,
            "days_of_week": reminder.days_of_week,
            "days_of_month": reminder.days_of_month,
            # Legacy fields (for backward compatibility)
            "interval_value": reminder.interval_value,
            "interval_unit": reminder.interval_unit,
        }
        return Response(data)


class ReminderCreateAjaxView(APIView):
    """Create a new reminder via AJAX (JSON only).

    Accepts POST with form-encoded reminder fields, validates via
    ``ReminderForm``, and returns JSON success or field errors. The reminder
    is associated with the current user and its ``next_trigger_at`` is
    calculated from the schedule fields before saving.
    """

    def post(self, request: Request) -> Response:
        """Validate and create a reminder for the current user.

        Args:
            request: The HTTP request containing form-encoded reminder data.

        Returns:
            Response with ``{"success": True, "redirect_url": ...}`` on
            success, or HTTP 400 with ``{"errors": {...}}`` on validation
            failure.
        """
        user = cast(User, request.user)
        form = ReminderForm(request.POST)
        if not form.is_valid():
            errors: dict[str, Any] = {
                field: list(field_errors) for field, field_errors in form.errors.items()
            }
            return Response({"errors": errors}, status=400)
        reminder = form.save(commit=False)
        reminder.user = user
        reminder.next_trigger_at = reminder.calculate_next_trigger_at()
        reminder.save()
        return Response({"success": True, "redirect_url": reverse("reminder:app")})


class ReminderUpdateAjaxView(APIView):
    """Update an existing reminder via AJAX (JSON only).

    Accepts POST with form-encoded reminder fields, validates via
    ``ReminderForm`` against the existing instance, and returns JSON success
    or field errors. ``next_trigger_at`` is recalculated from the schedule
    fields on every save. Access is limited to the reminder's owner — other
    users' reminders return 404.
    """

    def post(self, request: Request, uuid: str) -> Response:
        """Validate and update a reminder owned by the current user.

        Args:
            request: The HTTP request containing form-encoded reminder data.
            uuid: UUID of the reminder to update.

        Returns:
            Response with ``{"success": True, "redirect_url": ...}`` on
            success, or HTTP 400 with ``{"errors": {...}}`` on validation
            failure.
        """
        user = cast(User, request.user)
        reminder = get_object_or_404(Reminder, uuid=uuid, user=user)
        form = ReminderForm(request.POST, instance=reminder)
        if not form.is_valid():
            errors: dict[str, Any] = {
                field: list(field_errors) for field, field_errors in form.errors.items()
            }
            return Response({"errors": errors}, status=400)
        reminder = form.save(commit=False)
        reminder.next_trigger_at = reminder.calculate_next_trigger_at()
        reminder.save()
        return Response({"success": True, "redirect_url": reverse("reminder:app")})


class ReminderDeleteAjaxView(APIView):
    """Delete a reminder via AJAX (JSON only).

    Accepts POST to remove the reminder and returns JSON success. Access is
    limited to the reminder's owner — other users' reminders return 404.
    """

    def post(self, request: Request, uuid: str) -> Response:
        """Delete a reminder owned by the current user.

        Args:
            request: The HTTP request.
            uuid: UUID of the reminder to delete.

        Returns:
            Response with ``{"success": True, "redirect_url": ...}`` on
            success.
        """
        user = cast(User, request.user)
        reminder = get_object_or_404(Reminder, uuid=uuid, user=user)
        reminder.delete()
        return Response({"success": True, "redirect_url": reverse("reminder:app")})


class ReminderListAjaxView(APIView):
    """Serve reminders list as JSON for AJAX requests.

    This view returns the full set of reminders for the current user. The
    dashboard renders all groups and the right rail in one shot, so there is
    no pagination — the response is a flat list ordered by next_trigger_at
    ascending (then by recency).
    """

    def get(self, request: Request) -> Response:
        """Return reminder data as JSON.

        Args:
            request: The HTTP request object.

        Returns:
            Response containing the full reminders list for the user.
        """
        user = cast(User, request.user)
        queryset = Reminder.objects.filter(user=user).order_by(
            "next_trigger_at", "-created"
        )

        reminders_data = [
            {
                "uuid": str(reminder.uuid),
                "name": reminder.name,
                "note": reminder.note or "",
                "is_active": reminder.is_active,
                # New schedule fields
                "schedule_type": reminder.schedule_type,
                "schedule_description": reminder.get_schedule_description(),
                "days_of_week": reminder.days_of_week or [],
                "days_of_month": reminder.days_of_month or [],
                # Legacy fields (for backward compatibility)
                "interval_value": reminder.interval_value,
                "interval_unit_display": reminder.get_interval_unit_display().lower(),
                # Timestamps (convert to local timezone before formatting)
                "next_trigger_at": dateformat.format(timezone.localtime(reminder.next_trigger_at), "M d, g:i A") if reminder.next_trigger_at else None,
                "next_trigger_at_unix": int(dateformat.format(reminder.next_trigger_at, "U")) if reminder.next_trigger_at else None,
                # URLs
                "detail_url": reverse("reminder:detail", kwargs={"uuid": reminder.uuid}),
                "update_url": reverse("reminder:update", kwargs={"uuid": reminder.uuid}),
                "delete_url": reverse("reminder:delete", kwargs={"uuid": reminder.uuid}),
                "form_ajax_url": reverse("reminder:form-ajax", kwargs={"uuid": reminder.uuid}),
            }
            for reminder in queryset
        ]

        return Response({"reminders": reminders_data})
