import React from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Dashboard, Day, Kind } from "./types";

const tick = (value: string) => value.slice(5);
const colors = ["var(--accent)", "#45c9b0", "#fbbf24"];
export function TrackerChart({
  kind,
  data,
  onDay,
}: {
  kind: Exclude<Kind, "blood-pressure">;
  data: Dashboard;
  onDay: (day: Day) => void;
}) {
  const days = data.days;
  const available = days.some(d =>
    kind === "awakenings" ? d.awakenings !== null : d.weight !== null
  );
  if (!available)
    return (
      <div className="qs-empty">
        No {kind === "awakenings" ? "recorded awakenings or confirmed nights" : "readings"} in this
        range.
      </div>
    );
  const axis = (
    <>
      <CartesianGrid stroke="var(--line)" vertical={false} />
      <XAxis dataKey="date" tickFormatter={tick} minTickGap={36} />
      <YAxis
        width={50}
        allowDecimals={kind !== "awakenings"}
        domain={kind === "awakenings" ? [0, "auto"] : ["dataMin - 1", "dataMax + 1"]}
        tickFormatter={value => (kind === "weight" ? Number(value).toFixed(1) : String(value))}
      />
      <Tooltip
        labelFormatter={label =>
          kind === "awakenings"
            ? `${label} · ${days.find(d => d.date === label)?.status || "unreviewed"}`
            : label
        }
        formatter={value => (typeof value === "number" ? Math.round(value * 100) / 100 : value)}
        contentStyle={{
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
          color: "var(--fg-1)",
        }}
      />
      <Legend />
    </>
  );
  const handleClick = (state: { activeLabel?: string | number }) => {
    const day = days.find(d => d.date === state.activeLabel);
    if (day) onDay(day);
  };
  return (
    <div
      className="qs-chart"
      role="img"
      aria-label={`${kind} chart; readings are also available in the history table`}
    >
      <ResponsiveContainer width="100%" height={285}>
        {kind === "awakenings" ? (
          <BarChart data={days} onClick={handleClick}>
            {axis}
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
        ) : (
          <LineChart data={days} onClick={handleClick}>
            {axis}
            <Line
              isAnimationActive={false}
              dataKey="weight"
              name={`Daily mean (${data.unit})`}
              stroke={colors[0]}
              dot={{ r: 3 }}
              connectNulls={false}
            />
            <Line
              isAnimationActive={false}
              dataKey="weight_trend"
              name="7-day trend"
              stroke={colors[1]}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        )}
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
