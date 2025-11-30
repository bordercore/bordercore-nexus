"""Template filter for generating favicon URLs.

This module provides a Django template filter that generates favicon URLs
for a given website URL, with configurable size.
"""

from django import template

from lib.util import favicon_url

register = template.Library()


@register.filter(name="favicon")
def favicon(url: str | None, size: int = 32) -> str:
    """Generate a favicon URL for a given website URL.

    Args:
        url: Website URL to generate a favicon for. Can be None.
        size: Size of the favicon in pixels. Defaults to 32.

    Returns:
        URL string for the favicon image.
    """
    return favicon_url(url, size)
