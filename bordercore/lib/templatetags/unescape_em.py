"""Template filter for unescaping HTML <em> tags.

This module provides a Django template filter that unescapes HTML-encoded
<em> tags, typically used to display highlighted search results from
Elasticsearch, which surrounds matched terms in escaped <em> tags.
"""

from django import template
from django.utils.html import escape
from django.utils.safestring import mark_safe

register = template.Library()


@register.filter(name="unescape_em")
def unescape_em(text: str) -> str:
    """Unescape HTML-encoded <em> tags in text.

    Escapes all HTML first to prevent XSS, then selectively unescapes
    only ``<em>`` and ``</em>`` tags. This is typically used to display
    highlighted search results from Elasticsearch, which surrounds
    matched terms in escaped <em> tags.

    Args:
        text: String containing HTML-encoded <em> tags.

    Returns:
        SafeString with only <em> tags unescaped, safe for HTML rendering.
    """
    escaped = escape(text)
    # escape() turns the literal <em>/<\/em> tags that Elasticsearch emits into
    # &lt;em&gt;/&lt;/em&gt;; unescape only those so highlights render while all
    # other markup stays escaped (XSS-safe).
    result = escaped.replace("&lt;em&gt;", "<em>").replace("&lt;/em&gt;", "</em>")
    return mark_safe(result)
