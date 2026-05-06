/**
 * Date / number formatting helpers for the habit dashboard.  Pure functions —
 * no React, no DOM — so they're easy to unit-test.
 */

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const UPPER_WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const UPPER_MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

/** Parse an ISO YYYY-MM-DD string into a local-midnight Date. */
export function parseIsoDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

/** Today as YYYY-MM-DD using the user's local clock. */
export function todayIso(): string {
  return toIsoDate(new Date());
}

/** Format a Date as YYYY-MM-DD using its local fields (not UTC). */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Add `days` to an ISO date and return the resulting ISO string. */
export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** "Tue, May 5" — short, mixed case. */
export function shortDate(iso: string): string {
  const d = parseIsoDate(iso);
  return `${SHORT_WEEKDAYS[d.getDay()]}, ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "TUE, MAY 5" — uppercase, used in eyebrows. */
export function eyebrowDate(iso: string): string {
  const d = parseIsoDate(iso);
  return `${UPPER_WEEKDAYS[d.getDay()]}, ${UPPER_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Long form for the masthead: "Tuesday, May 5". */
const LONG_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
export function mastheadDate(iso: string): string {
  const d = parseIsoDate(iso);
  return `${LONG_WEEKDAYS[d.getDay()]}, ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Time-of-day greeting suffix (no trailing comma).  Locale-independent. */
export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "6 weeks ago", "2 yr 3 mo", "today" — used under the habit name. */
export function timeAgo(iso: string): string {
  const start = parseIsoDate(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(days / 365.25);
  const remMonths = Math.floor((days - years * 365.25) / 30.44);
  if (remMonths > 0) return `${years} yr ${remMonths} mo`;
  return `${years} yr`;
}

/** Days between two ISO dates, treating both as local-midnight. */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
