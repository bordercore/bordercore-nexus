/**
 * Tiny lowercase relative-time formatter used by the Bookshelf Card Catalog.
 *
 * Matches the design system's voice ("3 weeks ago", "just now") without
 * pulling in a date library.
 */
export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";

  const diffSec = Math.max(0, Math.floor((now.getTime() - t) / 1000));
  if (diffSec < 60) return "just now";

  const units: Array<[number, string]> = [
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Infinity, "year"],
  ];

  let value = diffSec / 60;
  for (let i = 0; i < units.length; i++) {
    const [divisor, name] = units[i];
    if (value < divisor || i === units.length - 1) {
      const rounded = Math.max(1, Math.floor(value));
      return `${rounded} ${name}${rounded === 1 ? "" : "s"} ago`;
    }
    value = value / divisor;
  }
  return "";
}
