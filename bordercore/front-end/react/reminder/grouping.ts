import type { FilterKey, Reminder, ReminderGroup, ReminderStats } from "./types";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const FIRING_SOON_THRESHOLD_MS = 60 * MINUTE_MS;
export const TODAY_TOMORROW_THRESHOLD_MS = 48 * HOUR_MS;
export const THIS_WEEK_THRESHOLD_MS = 7 * DAY_MS;

const GROUP_LABELS: Record<ReminderGroup["key"], string> = {
  "firing-soon": "⌁ firing soon",
  "today-tomorrow": "today & tomorrow",
  "this-week": "this week",
  later: "later",
  inactive: "inactive",
};

const GROUP_ORDER: ReminderGroup["key"][] = [
  "firing-soon",
  "today-tomorrow",
  "this-week",
  "later",
  "inactive",
];

function deltaMs(reminder: Reminder, now: Date): number | null {
  if (reminder.next_trigger_at_unix == null) return null;
  return reminder.next_trigger_at_unix * 1000 - now.getTime();
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function classify(reminder: Reminder, now: Date): ReminderGroup["key"] {
  if (!reminder.is_active) return "inactive";
  const delta = deltaMs(reminder, now);
  if (delta == null) return "later";
  if (delta <= FIRING_SOON_THRESHOLD_MS) return "firing-soon";
  if (delta <= TODAY_TOMORROW_THRESHOLD_MS) return "today-tomorrow";
  if (delta <= THIS_WEEK_THRESHOLD_MS) return "this-week";
  return "later";
}

export function bucketReminders(reminders: Reminder[], now: Date): ReminderGroup[] {
  const buckets = new Map<ReminderGroup["key"], Reminder[]>();
  for (const key of GROUP_ORDER) buckets.set(key, []);

  for (const reminder of reminders) {
    buckets.get(classify(reminder, now))!.push(reminder);
  }

  return GROUP_ORDER.map(key => ({
    key,
    label: GROUP_LABELS[key],
    reminders: buckets.get(key)!,
  })).filter(group => group.reminders.length > 0);
}

export function deriveImminent(reminders: Reminder[], now: Date): Reminder | null {
  for (const reminder of reminders) {
    if (classify(reminder, now) === "firing-soon") return reminder;
  }
  return null;
}

export function deriveNextActive(reminders: Reminder[], now: Date): Reminder | null {
  for (const reminder of reminders) {
    if (!reminder.is_active) continue;
    const delta = deltaMs(reminder, now);
    if (delta == null) continue;
    return reminder;
  }
  return null;
}

export function deriveUpNext(
  reminders: Reminder[],
  now: Date,
  excludeUuid?: string | null,
  limit = 3
): Reminder[] {
  const out: Reminder[] = [];
  for (const reminder of reminders) {
    if (out.length >= limit) break;
    if (!reminder.is_active) continue;
    if (excludeUuid && reminder.uuid === excludeUuid) continue;
    if (deltaMs(reminder, now) == null) continue;
    out.push(reminder);
  }
  return out;
}

export function deriveStats(reminders: Reminder[], now: Date): ReminderStats {
  let active = 0;
  let today = 0;
  let next7d = 0;
  for (const reminder of reminders) {
    if (!reminder.is_active) continue;
    active += 1;
    const delta = deltaMs(reminder, now);
    if (delta == null) continue;
    if (reminder.next_trigger_at_unix != null) {
      const triggerDate = new Date(reminder.next_trigger_at_unix * 1000);
      if (isSameLocalDay(triggerDate, now)) today += 1;
    }
    if (delta >= 0 && delta <= THIS_WEEK_THRESHOLD_MS) next7d += 1;
  }
  return { active, today, next_7d: next7d };
}

function matchesFilter(reminder: Reminder, filter: FilterKey, now: Date): boolean {
  if (filter === "all") return true;
  if (filter === "active") return reminder.is_active;
  if (filter === "today") {
    if (!reminder.is_active) return false;
    if (reminder.next_trigger_at_unix == null) return false;
    const triggerDate = new Date(reminder.next_trigger_at_unix * 1000);
    return isSameLocalDay(triggerDate, now);
  }
  return true;
}

function matchesQuery(reminder: Reminder, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = `${reminder.name}\n${reminder.note}`.toLowerCase();
  return haystack.includes(trimmed);
}

export function applyFilter(
  reminders: Reminder[],
  filter: FilterKey,
  query: string,
  now: Date
): Reminder[] {
  return reminders.filter(
    reminder => matchesFilter(reminder, filter, now) && matchesQuery(reminder, query)
  );
}

export function countByFilter(reminders: Reminder[], now: Date): Record<FilterKey, number> {
  return {
    all: reminders.length,
    active: reminders.filter(r => matchesFilter(r, "active", now)).length,
    today: reminders.filter(r => matchesFilter(r, "today", now)).length,
  };
}

export function isImminent(reminder: Reminder, now: Date): boolean {
  return classify(reminder, now) === "firing-soon";
}

export function classifyGroup(reminder: Reminder, now: Date): ReminderGroup["key"] {
  return classify(reminder, now);
}

export function formatCountdown(deltaMs: number): {
  hh: string;
  mm: string;
  ss: string;
  total_seconds: number;
} {
  const clamped = Math.max(0, Math.floor(deltaMs / 1000));
  const hh = Math.floor(clamped / 3600);
  const mm = Math.floor((clamped % 3600) / 60);
  const ss = clamped % 60;
  return {
    hh: String(hh).padStart(2, "0"),
    mm: String(mm).padStart(2, "0"),
    ss: String(ss).padStart(2, "0"),
    total_seconds: clamped,
  };
}

export function countdownProgress(deltaMs: number): number {
  if (deltaMs <= 0) return 1;
  if (deltaMs >= DAY_MS) return 0;
  return 1 - deltaMs / DAY_MS;
}
