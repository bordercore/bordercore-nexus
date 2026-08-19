// TypeScript interfaces for fitness app React components

export interface ActivityInfo {
  started?: string;
  relative_date?: string;
  schedule: boolean[];
  rest_period?: number | null;
  frequency?: number;
  schedule_days?: string;
  is_active?: boolean;
}

export interface LoggedSet {
  id: number;
  weight: number;
  reps: number;
  duration: number;
  note?: string;
  index: number;
  new?: boolean;
}

export interface RelatedExercise {
  uuid: string;
  name: string;
  last_active: string;
  exercise_url?: string;
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

export interface TargetedMuscles {
  primary: string[];
  secondary: string[];
}

export type PlotType = "reps" | "weight" | "duration";
