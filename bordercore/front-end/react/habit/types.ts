/**
 * Shared types for the Habit dashboard frontend.
 *
 * These mirror the JSON shapes returned by `habit/services.py`:
 *   - HabitSummary  ← get_habit_list      (landing page)
 *   - HabitDetail   ← get_habit_detail    (detail page, days=365)
 */

export interface RecentDay {
  /** ISO date (YYYY-MM-DD), local server date. */
  date: string;
  /** True if a HabitLog row exists for that date with completed=True. */
  completed: boolean;
}

export interface HabitSummary {
  uuid: string;
  name: string;
  purpose: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  tags: string[];
  unit: string;
  total_logs: number;
  completed_logs: number;
  completed_today: boolean;
  current_streak: number;
  /** Most recent HabitLog.value across all logs, or null if no log has a value. */
  last_value: string | null;
  /** Last 7 days, oldest-first; today is the final entry. */
  recent_logs: RecentDay[];
}

export interface HabitLogEntry {
  uuid: string;
  date: string;
  completed: boolean;
  value: string | null;
  note: string;
}

export interface HabitDetail {
  uuid: string;
  name: string;
  purpose: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  tags: string[];
  unit: string;
  current_streak: number;
  longest_streak: number;
  /** Up to N most recent logs, newest-first.  N = 365 from HabitDetailView. */
  logs: HabitLogEntry[];
}
