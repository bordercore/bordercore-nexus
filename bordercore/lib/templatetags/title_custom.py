"""Template filter for converting snake_case strings to Title Case.

This module provides a Django template filter that converts snake_case
strings (e.g., "question_count") to Title Case with spaces (e.g.,
"Question Count").
"""

from django import template

register = template.Library()


@register.filter(name="title_custom")
def object_attrib(name: str) -> str:
    """Convert a snake_case string to Title Case with spaces.

    Converts underscores to spaces and applies title case formatting.
    For example, "question_count" becomes "Question Count".

    Args:
        name: String in snake_case format to convert.

    Returns:
        Title Case string with underscores replaced by spaces.
    """
    return name.title().replace("_", " ")
