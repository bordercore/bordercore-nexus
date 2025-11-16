"""Django app configuration for the drill app.

This module defines the DrillConfig class, which configures the drill
application for Django's app registry system.
"""

from django.apps import AppConfig


class DrillConfig(AppConfig):
    """Configuration for the drill Django application.

    This app provides the spaced-repetition drill system, including
    question/answer flashcards with spaced-repetition metadata,
    study sessions, and progress tracking.
    """

    name = "drill"
