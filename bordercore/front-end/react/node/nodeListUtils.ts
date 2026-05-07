import type { AgeTone, NodeFilter, NodeListItem } from "./types";

// Archive boundary — matches the ≤2022 "archive" age-tier used by the card rails.
export const ARCHIVE_YEAR_CEILING = 2022;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function relDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 60) return `${Math.floor(diff / 86400 / 7)}w ago`;
  if (diff < 86400 * 365) return `${Math.floor(diff / 86400 / 30)}mo ago`;
  return `${Math.floor(diff / 86400 / 365)}y ago`;
}

export function yearOf(iso: string): number {
  return new Date(iso).getFullYear();
}

// Age-tier hue: fresher nodes glow accent, older ones fade to dim foreground.
// Routed through theme tokens so the brightness ramp (vibrant -> dim) survives
// on every theme. On Nebula the four-color gradient is preserved exactly; on
// other themes the first three tiers may collapse toward --accent (because
// most themes default --accent-2/-3 to --accent), but the freshness ramp
// still reads correctly.
export function ageTone(iso: string): AgeTone {
  const y = yearOf(iso);
  if (y >= 2026)
    return {
      rail: "var(--accent)",
      glow: "color-mix(in oklch, var(--accent) 45%, transparent)",
      label: "fresh",
    };
  if (y >= 2025)
    return {
      rail: "var(--accent-2)",
      glow: "color-mix(in oklch, var(--accent-2) 40%, transparent)",
      label: "recent",
    };
  if (y >= 2024)
    return {
      rail: "var(--accent-4)",
      glow: "color-mix(in oklch, var(--accent-4) 35%, transparent)",
      label: "current",
    };
  if (y >= 2023)
    return {
      rail: "var(--fg-3)",
      glow: "color-mix(in oklch, var(--fg-3) 25%, transparent)",
      label: "older",
    };
  return {
    rail: "var(--fg-4)",
    glow: "color-mix(in oklch, var(--fg-4) 20%, transparent)",
    label: "archive",
  };
}

export function yearSwatch(year: number): string {
  if (year >= 2026) return "var(--accent)";
  if (year >= 2025) return "var(--accent-2)";
  if (year >= 2024) return "var(--accent-4)";
  if (year >= 2023) return "var(--fg-3)";
  return "var(--fg-4)";
}

export function matchesFilter(node: NodeListItem, filter: NodeFilter): boolean {
  switch (filter.type) {
    case "all":
      return true;
    case "pinned":
      return !!node.pinned;
    case "with-todos":
      return node.todo_count > 0;
    case "empty":
      return node.collection_count === 0 && node.todo_count === 0;
    case "archive":
      return yearOf(node.modified) <= ARCHIVE_YEAR_CEILING;
    case "year":
      return yearOf(node.modified) === filter.year;
  }
}

export function filtersEqual(a: NodeFilter, b: NodeFilter): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "year" && b.type === "year") return a.year === b.year;
  return true;
}
