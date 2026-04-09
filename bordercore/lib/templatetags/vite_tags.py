"""Django template tags for loading Vite-built assets.

Reads the Vite manifest.json to resolve entry-point names to their built
file paths and emits the appropriate ``<script>`` and ``<link>`` HTML tags.
In DEBUG mode, assets are served directly from the Vite dev server for HMR.
"""

import json
import logging
import os
from typing import Any

from django import template
from django.conf import settings
from django.utils.safestring import SafeString, mark_safe

register = template.Library()

logger = logging.getLogger(__name__)
_MANIFEST_CACHE: dict[str, dict[str, Any]] | None = None
_MANIFEST_MTIME: float = 0.0
_VITE_PORT = os.environ.get("VITE_PORT", "5174")
_VITE_DEV_SERVER = f"http://localhost:{_VITE_PORT}"

def _manifest_path() -> str | None:
    """Locate the Vite manifest.json file on disk.

    Checks the Vite 5+ path first (``static/vite/.vite/manifest.json``),
    then falls back to the older location.

    Returns:
        Absolute path to the manifest file, or None if not found.
    """
    try:
        project_dir = settings.PROJECT_DIR
    except Exception as e:
        logger.error(f"Failed to get PROJECT_DIR: {e}")
        project_dir = None
    if not project_dir:
        logger.error("PROJECT_DIR is not set in settings")
        return None
    # Vite 5+ puts manifest in .vite/ subdirectory
    new_path = os.path.join(str(project_dir), "static", "vite", ".vite", "manifest.json")
    if os.path.exists(new_path):
        return new_path
    # Fallback for older Vite versions
    fallback_path = os.path.join(str(project_dir), "static", "vite", "manifest.json")
    if os.path.exists(fallback_path):
        return fallback_path
    logger.error(f"Manifest.json not found at {new_path} or {fallback_path}")
    return None

def _load_manifest() -> dict[str, dict[str, Any]]:
    """Load and cache the Vite manifest.json, reloading when the file changes.

    Returns:
        Parsed manifest dict mapping entry names to their build metadata.
    """
    global _MANIFEST_CACHE, _MANIFEST_MTIME
    path = _manifest_path()
    if not path:
        logger.error("Manifest path is None, returning empty manifest")
        _MANIFEST_CACHE = {}
        return _MANIFEST_CACHE
    if not os.path.exists(path):
        logger.error(f"Manifest file does not exist: {path}")
        _MANIFEST_CACHE = {}
        return _MANIFEST_CACHE

    # Reload only when the file has been modified
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        mtime = 0.0

    if _MANIFEST_CACHE is not None and mtime == _MANIFEST_MTIME:
        return _MANIFEST_CACHE

    try:
        with open(path, "r") as fh:
            _MANIFEST_CACHE = json.load(fh)
        _MANIFEST_MTIME = mtime
        assert _MANIFEST_CACHE is not None
        logger.info(f"Successfully loaded manifest from {path} with {len(_MANIFEST_CACHE)} entries")
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse manifest.json at {path}: {e}")
        _MANIFEST_CACHE = {}
    except Exception as e:
        logger.error(f"Failed to load manifest.json from {path}: {e}", exc_info=True)
        _MANIFEST_CACHE = {}
    assert _MANIFEST_CACHE is not None
    return _MANIFEST_CACHE


def _get_source_path(entry_name: str) -> str:
    """Derive the source file path from a build entry name.

    Converts build output names to source paths using naming conventions:
    - dist/js/javascript -> front-end/index.js (legacy entry point)
    - dist/css/* -> front-end/entries/*-css.js
    - dist/js/* -> front-end/entries/*.tsx
    """
    # Special case for legacy main entry point
    if entry_name == "dist/js/javascript":
        return "front-end/index.js"

    # CSS entries: dist/css/foo -> front-end/entries/foo-css.js
    if entry_name.startswith("dist/css/"):
        name = entry_name.replace("dist/css/", "")
        return f"front-end/entries/{name}-css.js"

    # JS/React entries: dist/js/foo -> front-end/entries/foo.tsx
    if entry_name.startswith("dist/js/"):
        name = entry_name.replace("dist/js/", "")
        return f"front-end/entries/{name}.tsx"

    # Fallback: return as-is (already a source path)
    return entry_name


@register.simple_tag
def vite_asset(entry_name: str) -> SafeString | str:
    """Return HTML tags (link/script) for a Vite-built entry from manifest.json.

    Usage: {% vite_asset "dist/js/javascript" %}
           {% vite_asset "front-end/entries/react-app.tsx" %}

    Supports both:
      - Legacy: entry_name matches the key directly (e.g. "dist/js/javascript")
      - Vite 5+: entry_name matches the "name" field or manifest key (src path)

    In DEBUG mode, serves from the Vite dev server.
    In production, serves from built manifest.json.
    """
    parts: list[str] = []

    # In DEBUG mode, serve from Vite dev server (unless tests request manifest)
    use_manifest = getattr(settings, "VITE_USE_MANIFEST", False)
    if settings.DEBUG and not use_manifest:
        # Derive source path from entry name using naming conventions
        source_path = _get_source_path(entry_name)

        # Add Vite client for HMR
        parts.append(f'<script type="module" src="{_VITE_DEV_SERVER}/@vite/client"></script>')

        # Add React Refresh preamble (required by @vitejs/plugin-react)
        # This must be added before any React components are loaded
        if "react" in entry_name or "react" in source_path or source_path.endswith(".tsx") or source_path.endswith(".jsx"):
            parts.append(f'''<script type="module">
  import {{ injectIntoGlobalHook }} from "{_VITE_DEV_SERVER}/@react-refresh"
  injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {{}}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>''')

        # Add the entry point
        parts.append(f'<script type="module" src="{_VITE_DEV_SERVER}/{source_path}"></script>')

        return mark_safe("\n".join(parts))

    # Production: use manifest
    manifest = _load_manifest()
    if not manifest:
        logger.error(f"Manifest is empty, cannot load asset: {entry_name}")
        return ""

    entry = None
    # Direct key lookup (Vite 5 uses src path as key)
    if entry_name in manifest:
        entry = manifest[entry_name]
    else:
        # Fallback: search by "name" field (for legacy entry names like "dist/js/react-app")
        for key, value in manifest.items():
            if value.get("name") == entry_name:
                entry = value
                break

    if not entry:
        logger.error(f"Entry '{entry_name}' not found in manifest. Available entries: {list(manifest.keys())[:10]}")
        return ""

    parts.clear()
    static_base = settings.STATIC_URL.rstrip("/") + "/vite/"

    # Collect all chunk dependencies for modulepreload hints
    seen: set[str] = set()
    def _collect_imports(ent: dict[str, Any]) -> None:
        for imp_key in ent.get("imports", []):
            if imp_key in seen:
                continue
            seen.add(imp_key)
            imp_entry = manifest.get(imp_key, {})
            imp_file = imp_entry.get("file")
            if imp_file:
                parts.append(f'<link rel="modulepreload" href="{static_base}{imp_file}">')
            # Also collect CSS from imported chunks
            for css in imp_entry.get("css", []):
                parts.append(f'<link rel="stylesheet" href="{static_base}{css}">')
            _collect_imports(imp_entry)

    # CSS from entry
    for css in entry.get("css", []):
        href = static_base + css
        parts.append(f'<link rel="stylesheet" href="{href}">')
    # Modulepreload hints for all chunk dependencies
    _collect_imports(entry)
    # JS entry point
    js_file = entry.get("file")
    if js_file:
        src = static_base + js_file
        parts.append(f'<script type="module" src="{src}"></script>')
    return mark_safe("\n".join(parts))
