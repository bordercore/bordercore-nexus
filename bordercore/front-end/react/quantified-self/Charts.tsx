import React from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Dashboard, Day } from "./types";

const tick = (value: string) => value.slice(5);
const colors = ["var(--accent)", "#45c9b0", "#fbbf24"];
export function TrackerChart({ data, onDay }: { data: Dashboard; onDay: (day: Day) => void }) {
  const days = data.days;
  if (!days.some(d => d.awakenings !== null))
    return (
      <div className="qs-empty">No recorded awakenings or confirmed nights in this range.</div>
    );
  const handleClick = (state: { activeLabel?: string | number }) => {
    const day = days.find(d => d.date === state.activeLabel);
    if (day) onDay(day);
  };
  return (
    <div
      className="qs-chart"
      role="img"
      aria-label="awakenings chart; readings are also available in the history table"
    >
      <ResponsiveContainer width="100%" height={285}>
        <BarChart data={days} onClick={handleClick}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={tick} minTickGap={36} />
          <YAxis width={50} allowDecimals={false} domain={[0, "auto"]} />
          <Tooltip
            labelFormatter={label =>
              `${label} · ${days.find(d => d.date === label)?.status || "unreviewed"}`
            }
            formatter={value => (typeof value === "number" ? Math.round(value * 100) / 100 : value)}
            contentStyle={{
              background: "var(--bg-1)",
              border: "1px solid var(--line)",
              color: "var(--fg-1)",
            }}
          />
          <Legend />
          <Bar
            dataKey="awakenings"
            name="Recorded awakenings"
            fill={colors[0]}
            isAnimationActive={false}
          >
            {days.map(day => (
              <Cell
                key={day.date}
                fill={day.status === "incomplete" ? colors[2] : colors[0]}
                fillOpacity={day.status === "unreviewed" ? 0.55 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Distribution({ data }: { data: Dashboard }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data.histogram}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="hour" minTickGap={30} />
        <YAxis allowDecimals={false} />
        <Tooltip contentStyle={{ background: "var(--bg-1)", border: "1px solid var(--line)" }} />
        <Bar
          isAnimationActive={false}
          dataKey="count"
          name="Recorded awakenings"
          fill={colors[1]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
