export type Kind = "awakenings" | "weight" | "blood-pressure";
export type Tab = "overview" | Kind | "imports";
export type Status = "unreviewed" | "complete" | "incomplete";
export interface Reading {
  uuid: string;
  source: string;
  external_id: string;
  note: string;
  excluded: boolean;
  date: string;
  time?: string;
  timezone?: string;
  utc_offset?: string;
  timestamp?: string;
  value?: string;
  unit?: string;
  kilograms?: number;
  systolic?: number;
  diastolic?: number;
  pulse?: number | null;
}
export interface Day {
  date: string;
  weight: number | null;
  weight_trend: number | null;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  systolic_trend: number | null;
  diastolic_trend: number | null;
  weight_samples: { uuid: string; value: number; time: string }[];
  pressure_samples: {
    uuid: string;
    systolic: number;
    diastolic: number;
    pulse: number | null;
    time: string;
  }[];
  awakenings: number | null;
  status: Status;
  revision: string | null;
  note: string;
  events: { uuid: string; hour: number; time: string; timestamp: string; note: string }[];
}
export interface Dashboard {
  days: Day[];
  unit: string;
  timezone: string;
  histogram: { hour: string; count: number }[];
  summary: {
    completed_nights: number;
    total_nights: number;
    mean_awakenings: number | null;
    recorded_awakenings: number;
    weight_days: number;
    pressure_days: number;
    pressure_readings: number;
    mean_systolic: number | null;
    mean_diastolic: number | null;
    latest_weight: Reading | null;
    weight_change: number | null;
    latest_pressure: Reading | null;
  };
}
export const labels: Record<Kind, string> = {
  awakenings: "Awakenings",
  weight: "Weight",
  "blood-pressure": "Blood pressure",
};
