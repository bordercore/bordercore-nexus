"""Shared lesson themes, applied at rendering time without altering saved versions."""

import colorsys
import re
from pathlib import Path
from typing import Any, TypedDict

DEFAULT_STYLE = "midnight-scholar"


class Theme(TypedDict):
    name: str
    description: str
    colors: list[str]


STYLES: dict[str, Theme] = {
    "neon-circuit": {
        "name": "Neon Circuit",
        "description": "Cyberpunk midnight, electric cyan, hot magenta, and acid-yellow accents. Technical type and sharp neon-edged panels.",
        "colors": [
            "#080b18",
            "#10172b",
            "#251040",
            "#e6faff",
            "#a8b9d4",
            "#4deaff",
            "#9b167d",
            "#f5ee70",
            "#ff68b5",
            "#67f5ce",
            "#375574",
            "#050811",
        ],
    },
    "midnight-scholar": {
        "name": "Midnight Scholar",
        "description": "Deep navy, warm ivory, lavender headings, and gold accents. Based on your dot-product attention lesson.",
        "colors": [
            "#0d1530",
            "#16214a",
            "#22306a",
            "#f6f1e3",
            "#c9c3d9",
            "#b7a6f2",
            "#7f6bd6",
            "#e8b85a",
            "#f08ca0",
            "#7fd6c4",
            "#34407a",
            "#0a1026",
        ],
    },
    "paper-ink": {
        "name": "Paper & Ink",
        "description": "Warm paper, dark ink, plum headings, and bronze accents for a light reading experience.",
        "colors": [
            "#f7f2e8",
            "#fffcf5",
            "#ebe1d0",
            "#272335",
            "#62586e",
            "#69438b",
            "#684398",
            "#875915",
            "#a13550",
            "#17665c",
            "#c9bfaf",
            "#eee7db",
        ],
    },
    "forest-study": {
        "name": "Forest Study",
        "description": "Evergreen backgrounds, cream text, sage headings, and amber accents.",
        "colors": [
            "#101f1b",
            "#192f28",
            "#28483d",
            "#f4f0dd",
            "#bfcec4",
            "#a4d3b2",
            "#406d58",
            "#e7bd70",
            "#eea0a0",
            "#7cd5cc",
            "#38594b",
            "#0b1814",
        ],
    },
}
TOKENS = [
    "bg",
    "panel",
    "glow",
    "text",
    "muted",
    "accent",
    "button",
    "gold",
    "rose",
    "teal",
    "border",
    "inset",
]
CSS = (Path(__file__).parent / "lesson-theme.css").read_text()
CYBERPUNK_CSS = (Path(__file__).parent / "cyberpunk.css").read_text()
HEX = re.compile(
    r"#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{3}\b"
)


def catalog() -> list[dict[str, Any]]:
    return [
        {
            "id": key,
            "name": value["name"],
            "description": value["description"],
            "colors": value["colors"][:4],
        }
        for key, value in STYLES.items()
    ]


def color_role(value: str) -> tuple[str, str]:
    digits = value.lstrip("#")
    if len(digits) in (3, 4):
        digits = "".join(c * 2 for c in digits)
    rgb = tuple(int(digits[i : i + 2], 16) / 255 for i in (0, 2, 4))
    h, s, v = colorsys.rgb_to_hsv(*rgb)
    # First preserve the exact reference palette. Other lessons map by visual role.
    for role, color in zip(TOKENS, STYLES[DEFAULT_STYLE]["colors"]):
        if digits[:6].lower() == color[1:]:
            return role, digits[6:]
    if v < 0.14:
        role = "inset"
    elif v < 0.24:
        role = "bg"
    elif v < 0.34:
        role = "panel"
    elif v < 0.55 and (s < 0.25 or 0.5 < h < 0.78):
        role = "border"
    elif s < 0.22:
        role = "text" if v > 0.88 else "muted"
    elif h < 0.05 or h > 0.90:
        role = "rose"
    elif h < 0.19:
        role = "gold"
    elif h < 0.53:
        role = "teal"
    else:
        role = "accent" if v > 0.68 else "button"
    return role, digits[6:]


def themed_html(html: str, style: str) -> str:
    """Theme legacy inline colors and shared typography; leave scripts/layouts intact."""
    style = style if style in STYLES else DEFAULT_STYLE
    palette = dict(zip(TOKENS, STYLES[style]["colors"]))

    def replace_color(match: re.Match[str]) -> str:
        role, alpha = color_role(match[0])
        return palette[role] + alpha

    def replace_sheet(match: re.Match[str]) -> str:
        return match[1] + HEX.sub(replace_color, match[2]) + match[3]

    def replace_attribute(match: re.Match[str]) -> str:
        return match[1] + match[2] + HEX.sub(replace_color, match[3]) + match[2]

    # Only edit CSS and presentation attributes; script strings and prose stay intact.
    chunks = re.split(r"(<script\b[^>]*>.*?</script\s*>)", html, flags=re.I | re.S)
    for i in range(0, len(chunks), 2):
        chunks[i] = re.sub(
            r"(<style\b[^>]*>)(.*?)(</style\s*>)",
            replace_sheet,
            chunks[i],
            flags=re.I | re.S,
        )
        chunks[i] = re.sub(
            r"(\bstyle\s*=\s*)([\"\'])(.*?)\2",
            replace_attribute,
            chunks[i],
            flags=re.I | re.S,
        )
    html = "".join(chunks)
    variables = (
        ":root{" + "".join(f"--lumen-{k}:{v};" for k, v in palette.items()) + "}"
    )
    # SVGs built dynamically by existing lesson scripts use literal colors too.
    svg_rules = []
    for color in sorted(set(HEX.findall("".join(chunks[1::2])) + HEX.findall(html))):
        role, _ = color_role(color)
        for prop in ("fill", "stroke"):
            svg_rules.append(
                f'svg [{prop}="{color}" i]{{{prop}:var(--lumen-{role})!important}}'
            )
    extra_css = CYBERPUNK_CSS if style == "neon-circuit" else ""
    sheet = f'<style id="lumen-lesson-theme" data-style="{style}">{variables}{CSS}{"".join(svg_rules)}{extra_css}</style>'
    # Last in body wins over both the generated CSS and the appended Q&A stylesheet.
    return re.sub(r"</body\s*>", lambda _: sheet + "</body>", html, count=1, flags=re.I)


def style_prompt(style: str) -> str:
    theme = STYLES.get(style, STYLES[DEFAULT_STYLE])
    palette = dict(zip(TOKENS, theme["colors"]))
    typography = (
        "Use system-ui sans-serif body text at 18px and line-height 1.7; bold uppercase ui-monospace headings, widely tracked small labels, angular 4px bordered panels, cyan edge highlights, magenta buttons, subtle grid backgrounds, and restrained neon glow. Keep paragraphs readable, with no flicker or glitch animation. "
        if style == "neon-circuit"
        else "Use Georgia/Iowan Old Style/Palatino serif body text at 18px and line-height 1.65; regular-weight serif headings; system-ui labels, buttons and small uppercase kickers; 18px rounded bordered cards, pill buttons, and a subtle radial page background. "
    )
    return (
        "\nRequired shared lesson style: "
        + theme["name"]
        + ". "
        + theme["description"]
        + "\n"
        + typography
        + "Use MathJax LaTeX formulas; a centered 980px reading column and generous section spacing. "
        + "Use these CSS variables for every color, including SVG and canvas drawing colors "
        "(read canvas colors using getComputedStyle): "
        + "; ".join(f"--lumen-{k}: {v}" for k, v in palette.items())
        + ". Keep layout and visualizations tailored to the topic, but follow this typography and palette. "
        "Do not hardcode additional colors. The application applies the current shared style at display time."
    )
