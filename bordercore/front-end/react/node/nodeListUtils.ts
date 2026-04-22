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

// Age-tier hue: fresher nodes glow purple, older ones fade to cool navy.
// Values are locked to the design spec — do not replace with theme tokens.
export function ageTone(iso: string): AgeTone {
  const y = yearOf(iso);
  if (y >= 2026) return { rail: "#b36bff", glow: "rgba(179,107,255,0.45)", label: "fresh" };
  if (y >= 2025) return { rail: "#7c7fff", glow: "rgba(124,127,255,0.40)", label: "recent" };
  if (y >= 2024) return { rail: "#4cc2ff", glow: "rgba(76,194,255,0.35)", label: "current" };
  if (y >= 2023) return { rail: "#4f6b9a", glow: "rgba(79,107,154,0.25)", label: "older" };
  return { rail: "#39415a", glow: "rgba(57,65,90,0.20)", label: "archive" };
}

export function yearSwatch(year: number): string {
  if (year >= 2026) return "#b36bff";
  if (year >= 2025) return "#7c7fff";
  if (year >= 2024) return "#4cc2ff";
  if (year >= 2023) return "#4f6b9a";
  return "#39415a";
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
