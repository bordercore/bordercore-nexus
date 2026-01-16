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

def _manifest_path() -> str | None:
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
    global _MANIFEST_CACHE
    if _MANIFEST_CACHE is not None:
        return _MANIFEST_CACHE
    path = _manifest_path()
    if not path:
        logger.error("Manifest path is None, returning empty manifest")
        _MANIFEST_CACHE = {}
        return _MANIFEST_CACHE
    if not os.path.exists(path):
        logger.error(f"Manifest file does not exist: {path}")
        _MANIFEST_CACHE = {}
        return _MANIFEST_CACHE
    try:
        with open(path, "r") as fh:
            _MANIFEST_CACHE = json.load(fh)
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


@register.simple_tag
def vite_asset(entry_name: str) -> SafeString | str:
    """Return HTML tags (link/script) for a Vite-built entry from manifest.json.

    Usage: {% vite_asset "dist/js/javascript" %}
           {% vite_asset "front-end/entries/react-app.tsx" %}

    Supports both:
      - Legacy: entry_name matches the key directly (e.g. "dist/js/javascript")
      - Vite 5+: entry_name matches the "name" field or manifest key (src path)

    In DEBUG mode, serves from Vite dev server (http://localhost:5173).
    In production, serves from built manifest.json.
    """
    # Map entry names to source file paths for dev mode
    entry_to_path = {
        "dist/js/javascript": "front-end/index.js",
        "dist/css/bordercore": "front-end/entries/bordercore-css.js",
        "dist/js/react-app": "front-end/entries/react-app.tsx",
        "dist/js/base-react": "front-end/entries/base-react.tsx",
        "dist/js/reminders": "front-end/entries/reminders.tsx",
        "dist/js/reminder-detail": "front-end/entries/reminder-detail.tsx",
        "dist/js/reminder-form": "front-end/entries/reminder-form.tsx",
        "dist/js/reminder-delete": "front-end/entries/reminder-delete.tsx",
        "dist/js/album-detail": "front-end/entries/album-detail.tsx",
        "dist/js/artist-detail": "front-end/entries/artist-detail.tsx",
    }

    parts: list[str] = []

    # In DEBUG mode, serve from Vite dev server
    if settings.DEBUG:
        source_path = entry_to_path.get(entry_name, entry_name)

        # Add Vite client for HMR
        parts.append('<script type="module" src="http://localhost:5173/@vite/client"></script>')

        # Add React Refresh preamble (required by @vitejs/plugin-react)
        # This must be added before any React components are loaded
        if "react" in entry_name or "react" in source_path or source_path.endswith(".tsx") or source_path.endswith(".jsx"):
            parts.append('''<script type="module">
  import { injectIntoGlobalHook } from "http://localhost:5173/@react-refresh"
  injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>''')

        # Add the entry point
        parts.append(f'<script type="module" src="http://localhost:5173/{source_path}"></script>')

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
    # CSS
    for css in entry.get("css", []):
        href = static_base + css
        parts.append(f'<link rel="stylesheet" href="{href}">')
    # JS
    js_file = entry.get("file")
    if js_file:
        src = static_base + js_file
        parts.append(f'<script type="module" src="{src}"></script>')
    return mark_safe("\n".join(parts))
