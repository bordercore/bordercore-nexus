"""Template filter for unescaping HTML <em> tags.

This module provides a Django template filter that unescapes HTML-encoded
<em> tags, typically used to display highlighted search results from
Elasticsearch, which surrounds matched terms in escaped <em> tags.
"""

from django import template

register = template.Library()


@register.filter(name="unescape_em")
def unescape_em(text: str) -> str:
    """Unescape HTML-encoded <em> tags in text.

    Converts HTML-encoded <em> tags (e.g., "&lt;em&gt;") back to regular
    HTML tags (e.g., "<em>"). This is typically used to display highlighted
    search results from Elasticsearch, which surrounds matched terms in
    escaped <em> tags.

    Args:
        text: String containing HTML-encoded <em> tags.

    Returns:
        String with <em> tags unescaped and ready for HTML rendering.
    """
    return text.replace("&lt;em&gt;", "<em>").replace("&lt;/em&gt;", "</em>")
