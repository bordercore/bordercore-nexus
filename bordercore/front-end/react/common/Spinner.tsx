import React from "react";

export type SpinnerProps = {
  /**
   * "sm" renders ~1rem / 16px; default "md" renders ~2rem / 32px.
   */
  size?: "sm" | "md";
  className?: string;
};

/**
 * Inline circular loading spinner using the theme accent color.
 *
 * Single-tone by design — every consumer wants the accent. Pass a Tailwind
 * `text-*` utility via `className` to override if a non-accent spinner is
 * ever needed. The `aria-label` covers screen readers, so callers don't
 * need to wrap a separate `sr-only` label span.
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
