// TypeScript interfaces for fitness app React components

export interface Exercise {
  exercise_url: string;
  exercise: string;
  muscle_group: string;
  schedule_days?: string;
  last_active: string | null;
  last_active_unixtime?: string;
  delta_days?: number;
  frequency?: string;
  overdue: number; // 0=normal, 1=selected, 2=overdue
}

export interface ActivityInfo {
  started?: string;
  relative_date?: string;
  schedule: boolean[];
  rest_period?: number;
}

export interface RelatedExercise {
  uuid: string;
  name: string;
  last_active: string;
}

export interface Paginator {
  has_previous: boolean;
  has_next: boolean;
  previous_page_number?: number;
  next_page_number?: number;
}

export interface PlotData {
  reps: number[][];
  weight?: number[][];
  duration?: number[][];
}

export interface PlotInfo {
  labels: string[];
  plot_data: PlotData;
  paginator: Paginator;
  notes: (string | null)[];
}

export interface WorkoutDataItem {
  index: number;
  weight: string;
  duration: string;
  reps: string;
  isEdit?: boolean;
}

export interface TargetedMuscles {
  primary: string[];
  secondary: string[];
}

export type PlotType = "reps" | "weight" | "duration";
