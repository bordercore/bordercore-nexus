"""Template filter for extracting domain names from URLs.

This module provides a Django template filter that extracts the domain name
(netloc) from a URL string using Python's urlparse.
"""

from urllib.parse import urlparse

from django import template

register = template.Library()


@register.filter(name="domain")
def domain(url: str | None) -> str:
    """Extract the domain name from a URL.

    Args:
        url: URL string to extract the domain from. Can be None or empty.

    Returns:
        The domain name (netloc) from the URL, or empty string if the URL
        is None or empty.
    """
    if not url:
        return ""

    return urlparse(url).netloc
