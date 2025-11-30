"""Template filter for dictionary key access.

This module provides a Django template filter that safely retrieves values
from dictionaries by key, returning None if the key doesn't exist.
"""

from typing import Any

from django import template

register = template.Library()


@register.filter(name="dict_get")
def object_attrib(dict: dict[str, Any], key: str) -> Any:
    """Retrieve a value from a dictionary by key.

    Args:
        dict: Dictionary to search for the key.
        key: Key to look up in the dictionary.

    Returns:
        The value associated with the key, or None if the key doesn't exist.
    """
    return dict.get(key)
