"""Middleware for the accounts app."""
from typing import Callable

from django.http import HttpRequest, HttpResponse
from django.utils import timezone

from accounts.models import UserSession, _client_ip


class ActiveSessionMiddleware:
    """Maintain a ``UserSession`` heartbeat for each authenticated session.

    A row is created by the ``user_logged_in`` signal on fresh logins, but
    this middleware also upserts on the first authenticated request from
    any session we don't yet have a record for (backfill for sessions that
    pre-date the model) and refreshes ``last_seen_at`` on every subsequent
    request so the preferences page can show relative "last seen" times.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)

        user = getattr(request, "user", None)
        session = getattr(request, "session", None)
        if (
            user is None
            or not user.is_authenticated
            or session is None
            or not session.session_key
        ):
            return response

        updated = UserSession.objects.filter(session_key=session.session_key).update(
            last_seen_at=timezone.now()
        )
        if updated == 0:
            UserSession.objects.update_or_create(
                session_key=session.session_key,
                defaults={
                    "user": user,
                    "user_agent": request.META.get("HTTP_USER_AGENT", "")[:500],
                    "ip_address": _client_ip(request),
                },
            )
        return response
