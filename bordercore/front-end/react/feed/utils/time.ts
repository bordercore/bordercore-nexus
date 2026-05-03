const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function formatRelativeShort(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MIN))}m`;
  if (diff < DAY) return `${Math.round(diff / HOUR)}h`;
  if (diff < WEEK) return `${Math.round(diff / DAY)}d`;
  return `${Math.round(diff / WEEK)}w`;
}
