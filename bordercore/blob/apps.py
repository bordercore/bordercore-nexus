"""App config for the blob app.

The ready() hook imports the live-sync signal handlers so they're
registered on startup.
"""

from django.apps import AppConfig


class BlobConfig(AppConfig):
    name = "blob"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        # Side-effect import: registers signal handlers.
        from blob import signals  # noqa: F401
