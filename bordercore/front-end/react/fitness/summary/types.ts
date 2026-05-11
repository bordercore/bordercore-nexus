// Types for the card-grid fitness landing page. Mirrors the payload built
// by fitness.services.get_fitness_card_summary on the server.

export type CardStatus = "today" | "overdue" | "on_track";
export type SparklineMetric = "weight" | "reps" | "duration" | null;

export interface ExerciseCardData {
  uuid: string;
  name: string;
  exercise_url: string;
  is_active: boolean;
  status: CardStatus;
  is_today: boolean;
  overdue_days: number;
  group: string;
  group_label: string;
  group_color_token: string;
  schedule: boolean[]; // 7 booleans, Monday-first
  last_workout_days_ago: number | null;
  last_weight: number | null;
  last_reps: number | null;
  sparkline: number[];
  sparkline_metric: SparklineMetric;
}

export interface FilterGroup {
  slug: string;
  label: string;
  color_token: string;
}

export interface SummaryPayload {
  today_dow: number;
  groups: FilterGroup[];
  exercises: ExerciseCardData[];
}
