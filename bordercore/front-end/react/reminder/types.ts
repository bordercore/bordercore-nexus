export interface Reminder {
  uuid: string;
  name: string;
  note: string;
  is_active: boolean;
  schedule_type: string;
  schedule_description: string;
  days_of_week: number[];
  days_of_month: number[];
  interval_value: number;
  interval_unit_display: string;
  next_trigger_at: string | null;
  next_trigger_at_unix: number | null;
  detail_url: string;
  update_url: string;
  delete_url: string;
  form_ajax_url: string;
}

export type ScheduleType = "daily" | "weekly" | "monthly";

export type FilterKey = "all" | "active" | "today";

export type GroupKey = "firing-soon" | "today-tomorrow" | "this-week" | "later" | "inactive";

export interface ReminderGroup {
  key: GroupKey;
  label: string;
  reminders: Reminder[];
}

export interface ReminderStats {
  active: number;
  today: number;
  next_7d: number;
}
