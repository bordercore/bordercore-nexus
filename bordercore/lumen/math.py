"""Embed the site's MathJax renderer without relaxing lesson sandbox policies."""

import re
import gzip
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def math_assets() -> str:
    script = gzip.decompress((Path(__file__).parent / "vendor" / "mathjax.js.gz").read_bytes()).decode()
    # HTML parsers recognize closing script tags even inside JavaScript strings.
    script = re.sub(r"</script", r"<\\/script", script, flags=re.I)
    return (
        '<style>mjx-container{display:inline-block;max-width:100%;overflow-x:auto;overflow-y:hidden;}'
        'mjx-container[display="true"]{display:block;margin:1em 0;text-align:center;}'
        'mjx-container svg{display:inline-block!important;max-width:none;width:auto!important;height:auto!important;}'
        'mjx-container svg text{fill:currentColor!important;}'
        '#lumen-review .lumen-source-markdown p{white-space:normal;}'
        '.lumen-source-markdown pre{overflow-x:auto;padding:1em;white-space:pre;}'
        '</style><script id="lumen-mathjax">' + script + '</script>'
    )


def with_math(html: str) -> str:
    """Render archived notation at display/download time without rewriting history."""
    return re.sub(r"</body\s*>", lambda _: math_assets() + "</body>", html, count=1, flags=re.I)
