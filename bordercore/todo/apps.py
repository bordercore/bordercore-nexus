"""App config for the todo app.

The ready() hook imports our signal handlers so they're registered on
startup. The existing m2m_changed handler in todo/models.py:206 keeps
working — Django allows multiple receivers on the same signal.
"""

from django.apps import AppConfig


class TodoConfig(AppConfig):
    name = "todo"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        # Side-effect import: registers signal handlers.
        from todo import signals  # noqa: F401
