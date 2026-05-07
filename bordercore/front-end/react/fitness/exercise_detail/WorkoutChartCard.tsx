import React, { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { doGet } from "../../utils/reactUtils";
import type { PlotInfo, PlotType } from "../types";
import { StatsStrip } from "./StatsStrip";

// Per-set line colors. Routed through theme tokens so the chart retints
// alongside the rest of the page.
const SET_COLORS = [
  "var(--accent)",
  "var(--accent-4)",
  "var(--ok)",
  "var(--warn)",
  "var(--accent-3)",
];

const UNIT_LABEL: Record<PlotType, string> = {
  weight: "lb",
  reps: "reps",
  duration: "sec",
};

interface WorkoutChartCardProps {
  exerciseUuid: string;
  getWorkoutDataUrl: string;
  hasWeight: boolean;
  hasDuration: boolean;
}

interface ChartRow {
  label: string;
  note: string | null;
  [setKey: `set${number}`]: number | undefined;
}

function buildChartRows(
  labels: string[],
  data: number[][],
  notes: (string | null)[]
): {
  rows: ChartRow[];
  maxSets: number;
} {
  let maxSets = 0;
  for (const sets of data) {
    if (sets.length > maxSets) maxSets = sets.length;
  }
  const rows: ChartRow[] = labels.map((label, i) => {
    const row: ChartRow = { label, note: notes[i] ?? null };
    const sets = data[i] || [];
    for (let s = 0; s < maxSets; s++) {
      const value = sets[s];
      row[`set${s + 1}`] = value === null || value === undefined ? undefined : value;
    }
    return row;
  });
  return { rows, maxSets };
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: { dataKey: string; value: number; color: string; name: string }[];
  note?: string | null;
  unit: string;
}

function ChartTooltip({ active, label, payload, note, unit }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="ex-chart-tooltip">
      <div className="label">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="entry">
          {/* swatch/value colors are per-series — must remain inline */}
          <span className="swatch" style={{ background: p.color }} />
          <span className="key">{p.dataKey}</span>
          {/* must remain inline */}
          <span className="value" style={{ color: p.color }}>
            {p.value}
            <span className="unit">{unit}</span>
          </span>
        </div>
      ))}
      {note && <div className="note">// {note}</div>}
    </div>
  );
}

export function WorkoutChartCard({
  exerciseUuid,
  getWorkoutDataUrl,
  hasWeight,
  hasDuration,
}: WorkoutChartCardProps) {
  const [plotInfo, setPlotInfo] = useState<PlotInfo | null>(null);
  const [series, setSeries] = useState<PlotType>("reps");
  const [loading, setLoading] = useState<boolean>(true);

  // Preferred initial series comes from the first response.
  const loadPage = (pageNumber: number) => {
    setLoading(true);
    doGet(
      `${getWorkoutDataUrl}${pageNumber}`,
      response => {
        const wd = response.data.workout_data as PlotInfo & { initial_plot_type?: PlotType };
        setPlotInfo({
          labels: wd.labels,
          plot_data: wd.plot_data,
          paginator: wd.paginator,
          notes: wd.notes ?? [],
        });
        setSeries(cur => {
          // Only adopt the server's preferred series on the first load.
          if (plotInfo == null && wd.initial_plot_type) return wd.initial_plot_type;
          return cur;
        });
        setLoading(false);
      },
      "Error getting workout data"
    );
  };

  useEffect(() => {
    loadPage(1);
  }, [exerciseUuid]);

  // Pagination: the API intentionally swaps has_previous/has_next so that
  // "previous" means "older workouts" (later page number).
  const paginator = plotInfo?.paginator;
  const canGoOlder = paginator?.has_previous ?? false;
  const canGoNewer = paginator?.has_next ?? false;

  const availableSeries: PlotType[] = useMemo(() => {
    const list: PlotType[] = ["reps"];
    if (hasWeight && plotInfo?.plot_data?.weight) list.push("weight");
    if (hasDuration && plotInfo?.plot_data?.duration) list.push("duration");
    return list;
  }, [plotInfo, hasWeight, hasDuration]);

  const seriesData = useMemo(() => {
    if (!plotInfo) return { rows: [] as ChartRow[], maxSets: 0 };
    const arr = plotInfo.plot_data[series] || [];
    return buildChartRows(plotInfo.labels, arr, plotInfo.notes);
  }, [plotInfo, series]);

  const currentPageData = plotInfo?.plot_data[series] || [];
  const firstNote = plotInfo?.notes.find(n => n);
  const firstNoteIndex = firstNote ? plotInfo!.notes.indexOf(firstNote) : -1;

  return (
    <div className="ex-card ex-chart-card">
      <div className="ex-chart-head">
        <div className="ex-chart-title">
          <span>workout data</span>
          <span className="spark">// last {plotInfo?.labels.length ?? 0} sessions</span>
        </div>
        <div className="ex-seg" role="tablist">
          {availableSeries.map(s => {
            const last = plotInfo?.plot_data[s]?.[plotInfo.plot_data[s]!.length - 1] ?? [];
            const best = last.length > 0 ? Math.max(...last) : 0;
            return (
              <button
                key={s}
                type="button"
                className={series === s ? "active" : ""}
                onClick={() => setSeries(s)}
                role="tab"
                aria-selected={series === s}
              >
                {s}
                <span className="badge">
                  {best}
                  {UNIT_LABEL[s]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <StatsStrip data={currentPageData} series={series} />

      <div className="ex-chart-body">
        {loading && !plotInfo ? (
          <div className="ex-chart-state">// loading workout data…</div>
        ) : seriesData.rows.length === 0 ? (
          <div className="ex-chart-state">// no {series} data yet for this exercise.</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={seriesData.rows} margin={{ top: 14, right: 16, left: -8, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--hairline)" strokeDasharray="2 4" />
              <XAxis
                dataKey="label"
                stroke="var(--fg-4)"
                tick={{
                  fill: "var(--fg-3)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
                tickLine={false}
                axisLine={{ stroke: "var(--hairline)" }}
              />
              <YAxis
                stroke="var(--fg-4)"
                tick={{
                  fill: "var(--fg-4)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                content={<ChartTooltip unit={UNIT_LABEL[series]} note={null} />}
                cursor={{ stroke: "var(--line)", strokeDasharray: "3 3" }}
              />
              {Array.from({ length: seriesData.maxSets }).map((_, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`set${i + 1}`}
                  stroke={SET_COLORS[i % SET_COLORS.length]}
                  strokeWidth={2}
                  dot={{
                    r: 3,
                    fill: "var(--bg-1)",
                    stroke: SET_COLORS[i % SET_COLORS.length],
                    strokeWidth: 1.5,
                  }}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                  animationDuration={240}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="ex-chart-footer">
        <div className="ex-chart-note">
          {firstNote && firstNoteIndex >= 0
            ? `${plotInfo!.labels[firstNoteIndex]}: ${firstNote}`
            : "no workout notes"}
        </div>
        <div className="ex-pager">
          <button
            type="button"
            title="older"
            disabled={!canGoOlder}
            onClick={() =>
              paginator?.previous_page_number && loadPage(paginator.previous_page_number)
            }
          >
            ‹
          </button>
          <button
            type="button"
            title="newer"
            disabled={!canGoNewer}
            onClick={() => paginator?.next_page_number && loadPage(paginator.next_page_number)}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
