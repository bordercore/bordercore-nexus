/** @type {import('tailwindcss').Config} */

// =============================================================================
// Theme-token bridge
// =============================================================================
// Each entry below maps a Tailwind theme key to a CSS custom property that is
// defined per theme in static/scss/themes/_theme-*.scss. Because the values
// are CSS variables (not literal colors), every theme that the user can
// activate via the `color-mode` attribute on <html> will retint Tailwind
// utilities automatically — no per-theme Tailwind config needed.
//
// Naming convention (Tailwind class name → CSS variable):
//   surface-0..4   → --bg-0..4         (backgrounds, increasing depth)
//   ink-0..4       → --fg-0..4         (foreground / text, decreasing emphasis)
//   line / line-soft / hairline        → matching --line* tokens
//   accent / accent-soft / ...         → --accent*
//   ok / warn / danger / favorite      → semantic state colors
//   muscle-{chest,back,...}            → fitness-summary accents
//
// Use these utilities (`bg-surface-2`, `text-ink-1`, `border-line-soft`, etc.)
// in JSX so every theme retints automatically.
// =============================================================================

const cssVar = name => `var(--${name})`;

const colors = {
  // Backgrounds / surfaces
  surface: {
    0: cssVar("bg-0"),
    1: cssVar("bg-1"),
    2: cssVar("bg-2"),
    3: cssVar("bg-3"),
    4: cssVar("bg-4"),
  },

  // Foreground / text
  ink: {
    0: cssVar("fg-0"),
    1: cssVar("fg-1"),
    2: cssVar("fg-2"),
    3: cssVar("fg-3"),
    4: cssVar("fg-4"),
  },

  // Lines / dividers / separators
  line: {
    DEFAULT: cssVar("line"),
    soft: cssVar("line-soft"),
  },
  hairline: cssVar("hairline"),

  // Accent family
  accent: {
    DEFAULT: cssVar("accent"),
    soft: cssVar("accent-soft"),
    glow: cssVar("accent-glow"),
    fg: cssVar("accent-fg"),
    2: cssVar("accent-2"),
    3: cssVar("accent-3"),
    4: cssVar("accent-4"),
    bookmark: cssVar("accent-bookmark"),
    cyan: cssVar("accent-cyan"),
  },
  "rail-head": cssVar("rail-head"),

  // Semantic state
  ok: cssVar("ok"),
  warn: cssVar("warn"),
  danger: cssVar("danger"),
  favorite: cssVar("favorite-color"),
  notice: cssVar("text-notice"),

  // Muscle-group accents (used by /fitness/ summary)
  muscle: {
    chest: cssVar("muscle-chest"),
    back: cssVar("muscle-back"),
    legs: cssVar("muscle-legs"),
    arms: cssVar("muscle-arms"),
    shoulders: cssVar("muscle-shoulders"),
    abs: cssVar("muscle-abs"),
    other: cssVar("muscle-other"),
  },

  // Form / input chrome
  form: {
    bg: cssVar("form-bg"),
    "bg-focus": cssVar("form-bg-focus"),
    border: cssVar("form-border-color-hover"),
  },

  // Sidebar / nav rail
  sidebar: {
    DEFAULT: cssVar("sidebar-color"),
    active: cssVar("sidebar-active-color"),
    hover: cssVar("sidebar-hover-color"),
  },
};

module.exports = {
  content: [
    "./front-end/**/*.{ts,tsx,js,jsx}",
    "./templates/**/*.html",
  ],
  corePlugins: {
    // Preflight (Tailwind's element reset) is off because its opinions
    // — notably `h1-h6 { font-size: inherit }` — would clash with the
    // typography in static/scss/base/_reset.scss. The project owns the reset.
    preflight: false,
  },
  theme: {
    extend: {
      colors,
      borderRadius: {
        DEFAULT: cssVar("radius"),
        lg: cssVar("radius-lg"),
        xl: cssVar("radius-xl"),
      },
      boxShadow: {
        sm: cssVar("shadow-sm"),
        md: cssVar("shadow-md"),
        lg: cssVar("shadow-lg"),
      },
      fontFamily: {
        // CSS-var substitution preserves the comma-separated font stack.
        sans: [cssVar("font-ui")],
        mono: [cssVar("font-mono")],
      },
    },
  },
  plugins: [
    // strategy: "class" makes @tailwindcss/forms opt-in (via .form-input,
    // .form-select, .form-checkbox, .form-radio, .form-textarea). The
    // default "base" strategy would apply styles globally to every <input>,
    // <select>, and <textarea> via low-specificity :where() selectors and
    // silently restyle the ~150 raw form elements in this codebase that
    // don't carry one of those classes.
    require("@tailwindcss/forms")({ strategy: "class" }),
    require("@tailwindcss/typography"),
  ],
};
