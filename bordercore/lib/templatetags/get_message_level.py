"""Template filter for converting Django message levels to Bootstrap alert levels.

This module provides a Django template filter that converts Django's message
level tags (debug, info, success, warning, error) to equivalent Bootstrap
alert CSS classes for consistent styling.
"""

from django import template

register = template.Library()


DJANGO_TO_BOOTSTRAP = {
    "debug": "info",
    "info": "info",
    "success": "success",
    "warning": "warning",
    "error": "danger"
}

DEFAULT_LEVEL = "info"


@register.filter(name="get_message_level")
def object_attrib(string: str) -> str:
    """Convert a Django message level to a Bootstrap alert level.

    Maps Django message levels to Bootstrap alert CSS classes. If the level
    is not recognized, returns the default "info" level.

    Args:
        string: Django message level string (debug, info, success, warning,
            or error).

    Returns:
        Bootstrap alert level string (info, success, warning, or danger).
        Returns "info" if the input level is not recognized.
    """
    return DJANGO_TO_BOOTSTRAP.get(string, DEFAULT_LEVEL)
