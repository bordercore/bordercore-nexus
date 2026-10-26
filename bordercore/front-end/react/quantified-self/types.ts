export type Kind = "awakenings" | "weight" | "blood-pressure" | "resting-heart-rate" | "hrv";
export type TrackerView = Kind | "sleep";
export type Tab = "overview" | TrackerView | "imports";
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
  resting_heart_rate: number | null;
  resting_heart_rate_trend: number | null;
  resting_heart_rate_samples: { uuid: string; value: number; time: string }[];
  hrv: number | null;
  hrv_trend: number | null;
  hrv_samples: { uuid: string; value: number; time: string }[];
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
  events: {
    uuid: string;
    hour: number;
    time: string;
    timestamp: string;
    note: string;
    source: string;
  }[];
}
export interface Dashboard {
  sleep?: SleepData;
  days: Day[];
  unit: string;
  timezone: string;
  histogram: { hour: string; count: number }[];
  summary: {
    resting_heart_rate_days: number;
    resting_heart_rate_readings: number;
    mean_resting_heart_rate: number | null;
    latest_resting_heart_rate: Reading | null;
    hrv_days: number;
    hrv_readings: number;
    mean_hrv: number | null;
    latest_hrv: Reading | null;
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
  "resting-heart-rate": "Resting heart rate",
  hrv: "HRV",
  awakenings: "Awakenings",
  weight: "Weight",
  "blood-pressure": "Blood pressure",
};

export type CardiacKind = "resting-heart-rate" | "hrv";
export const cardiacMetrics = {
  "resting-heart-rate": { key: "resting_heart_rate", unit: "bpm", label: "Resting heart rate" },
  hrv: { key: "hrv", unit: "ms", label: "HRV (SDNN)" },
} as const;

export type SleepStage = "awake" | "light" | "deep" | "rem" | "asleep" | "restless" | "in_bed";
export interface SleepDay {
  date: string;
  asleep_seconds: number | null;
  trend_seconds: number | null;
  duration_basis: "reported" | "stages" | null;
  stages: Record<SleepStage, number>;
  session_count: number;
  bedtime: string | null;
  wake_time: string | null;
  recorded_awakenings: number;
  intervals?: { start: string; end: string; stage: SleepStage }[];
}
export interface SleepData {
  days: SleepDay[];
  timezone: string;
  source: { id: number; name: string; latest: string } | null;
  sources: { id: number; name: string; latest: string }[];
  summary: { nights: number; mean_seconds: number | null; latest: SleepDay | null };
  events?: { uuid: string; timestamp: string; source: string }[];
}
