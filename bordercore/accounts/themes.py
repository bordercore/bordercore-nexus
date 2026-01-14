"""Theme configuration for Bordercore.

This module defines available themes and provides utilities for theme management.
Theme identifiers (css_id) must match the SCSS file names and color-mode attribute values.
"""

from dataclasses import dataclass
from typing import Dict, List, Tuple


@dataclass(frozen=True)
class Theme:
    """Represents a UI theme configuration.

    Attributes:
        css_id: The identifier used in CSS (color-mode attribute) and database.
                Must match the SCSS filename (e.g., "dark" -> theme-dark.scss)
        display_name: Human-readable name shown in the UI dropdown.
        description: Optional description of the theme.
    """

    css_id: str
    display_name: str
    description: str = ""


# Theme Registry - Add new themes here
# The css_id must match:
#   1. The SCSS file: themes/_theme-{css_id}.scss
#   2. The CSS selector: :root[color-mode="{css_id}"]
THEMES: Dict[str, Theme] = {
    "light": Theme(
        css_id="light",
        display_name="Light",
        description="Clean, bright interface",
    ),
    "dark": Theme(
        css_id="dark",
        display_name="Midnight Slate",
        description="Dark blue tones for low-light environments",
    ),
    "purple": Theme(
        css_id="purple",
        display_name="Purple",
        description="Rich purple color scheme",
    ),
    "cyberpunk": Theme(
        css_id="cyberpunk",
        display_name="Cyberpunk",
        description="Neon pinks and cyans on dark purple",
    ),
}

# Default theme for new users
DEFAULT_THEME = "light"


def get_theme_choices() -> List[Tuple[str, str]]:
    """Return theme choices formatted for Django model/form fields.

    Returns:
        List of (css_id, display_name) tuples for use in CharField choices.
    """
    return [(theme.css_id, theme.display_name) for theme in THEMES.values()]


def get_theme(css_id: str) -> Theme | None:
    """Get a theme by its CSS identifier.

    Args:
        css_id: The CSS identifier for the theme.

    Returns:
        The Theme object, or None if not found.
    """
    return THEMES.get(css_id)


def get_display_name(css_id: str) -> str:
    """Get the display name for a theme.

    Args:
        css_id: The CSS identifier for the theme.

    Returns:
        The display name, or the css_id if theme not found.
    """
    theme = THEMES.get(css_id)
    return theme.display_name if theme else css_id
