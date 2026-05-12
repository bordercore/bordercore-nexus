import React from "react";

export type SpinnerProps = {
  /**
   * "sm" matches Bootstrap's `.spinner-border-sm` (~1rem / 16px).
   * Default "md" matches Bootstrap's `.spinner-border` (~2rem / 32px).
   */
  size?: "sm" | "md";
  className?: string;
};

/**
 * Inline circular loading spinner using the theme accent color.
 *
 * Replaces Bootstrap's `.spinner-border` / `.spinner-border-sm`. The
 * legacy code carried Bootstrap `text-primary` and `text-secondary`
 * modifiers, but those were silently overridden by
 * `_bootstrap.scss .spinner-border { color: var(--accent) }`, so every
 * existing spinner rendered in the accent color regardless. This
 * component is intentionally single-tone for that reason; if a
 * non-accent spinner is needed in the future, pass a Tailwind text-*
 * utility via `className` to override.
 *
 * The `aria-label` is sufficient for screen readers, so callers no
 * longer need to wrap a `sr-only` label span.
 */
export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizing = size === "sm" ? "w-4 h-4 border-[0.15em]" : "w-8 h-8 border-[0.2em]";
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`inline-block rounded-full border-current border-r-transparent animate-spin text-accent align-[-0.125em] ${sizing} ${className ?? ""}`.trim()}
    />
  );
}

export default Spinner;
