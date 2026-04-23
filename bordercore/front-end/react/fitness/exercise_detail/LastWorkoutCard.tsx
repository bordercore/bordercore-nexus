import React from "react";

type Unit = "lb" | "reps" | "sec";

interface SetGroup {
  label: string;
  unit: Unit;
  values: number[];
  prev: number[];
  sumLabel: string;
}

interface LastWorkoutCardProps {
  date: string;
  hasWeight: boolean;
  hasDuration: boolean;
  latestWeight: number[];
  latestReps: number[];
  latestDuration: number[];
  previousWeight: number[];
  previousReps: number[];
  previousDuration: number[];
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function delta(cur: number, prev?: number): { cls: string; txt: string } {
  if (prev === undefined || prev === null) {
    return { cls: "flat", txt: "—" };
  }
  const diff = cur - prev;
  if (diff > 0) return { cls: "up", txt: `+${Number(diff.toFixed(2))}` };
  if (diff < 0) return { cls: "down", txt: `${Number(diff.toFixed(2))}` };
  return { cls: "flat", txt: "±0" };
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const dateFmt = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(seconds, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(seconds / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(seconds / 2592000), "month");
  return rtf.format(Math.round(seconds / 31536000), "year");
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

export function LastWorkoutCard({
  date,
  hasWeight,
  hasDuration,
  latestWeight,
  latestReps,
  latestDuration,
  previousWeight,
  previousReps,
  previousDuration,
}: LastWorkoutCardProps) {
  const groups: SetGroup[] = [];
  if (hasWeight && latestWeight.length > 0) {
    groups.push({
      label: "weight",
      unit: "lb",
      values: latestWeight,
      prev: previousWeight,
      sumLabel: `total ${sum(latestWeight)}lb`,
    });
  }
  if (latestReps.length > 0) {
    groups.push({
      label: "reps",
      unit: "reps",
      values: latestReps,
      prev: previousReps,
      sumLabel: `total ${sum(latestReps)}`,
    });
  }
  if (hasDuration && latestDuration.length > 0) {
    groups.push({
      label: "duration",
      unit: "sec",
      values: latestDuration,
      prev: previousDuration,
      sumLabel: `total ${sum(latestDuration)}s`,
    });
  }

  const hasWorkout = groups.length > 0 && date !== "";
  const metaText = hasWorkout
    ? `${formatDisplayDate(date)} · ${formatRelative(date)}`
    : "none logged yet";

  return (
    <div className="ex-card">
      <h3>
        <span>last workout</span>
        <span className="ex-card-hint">{metaText}</span>
      </h3>
      {!hasWorkout ? (
        <p className="ex-no-description">no sets logged for this exercise yet.</p>
      ) : (
        groups.map(group => (
          <div key={group.label} className="ex-set-group">
            <div className="ex-set-group-label">
              <span>{group.label}</span>
              <span className="sum">{group.sumLabel}</span>
            </div>
            <div className="ex-sets">
              {group.values.map((value, i) => {
                const d = delta(value, group.prev?.[i]);
                return (
                  <div key={i} className="ex-set">
                    <span className="num">{value}</span>
                    <span className="unit">{group.unit}</span>
                    <span className="label">set {i + 1}</span>
                    <span className={`delta ${d.cls}`}>{d.txt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
