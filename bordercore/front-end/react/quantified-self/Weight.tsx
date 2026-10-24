import React, { useEffect, useId, useMemo, useState } from "react";
import { api, daysBefore } from "./api";
import { dateTicks, line, scale, useWidth } from "./chart";
import {
  ALL_DAYS,
  ChartTooltip,
  Flag,
  Kpi,
  Metric,
  ReadingsTable,
  StatusLine,
  Toggle,
  clock,
  datesBetween,
  latestReading,
  mean,
  nearest,
  plural,
  rangePreset,
  scrollToReadings,
  short,
  stamp,
  useRecords,
} from "./Ledger";
import { Reading } from "./types";

const KG_PER_LB = 0.45359237;
type Unit = "lb" | "kg";
type Weighed = Reading & { kilograms: number };
type DayMean = { date: string; value: number; readings: Weighed[] };
type ImportBatch = {
  uuid: string;
  kind: string;
  source: string;
  created_at: string;
  committed: boolean;
};

const other = (unit: Unit): Unit => (unit === "lb" ? "kg" : "lb");
export const convert = (kilograms: number, unit: Unit) =>
  unit === "lb" ? kilograms / KG_PER_LB : kilograms;
const fixed = (value: number | null | undefined) => (value == null ? "—" : value.toFixed(1));
const signed = (value: number) =>
  `${value > 0.049 ? "+" : value < -0.049 ? "−" : ""}${Math.abs(value).toFixed(1)}`;
// Falling weight reads as good, rising as bad; changes under a rounding step stay neutral.
const directionTone = (delta: number | null) =>
  delta == null || Math.abs(delta) < 0.05 ? undefined : delta < 0 ? "ok" : "danger";
const arrow = (delta: number) => (delta < 0 ? "↓" : "↑");

export function dailyMeans(readings: Weighed[], unit: Unit): Map<string, DayMean> {
  const byDay = new Map<string, Weighed[]>();
  for (const r of readings) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
  const result = new Map<string, DayMean>();
  for (const [date, rows] of byDay) {
    result.set(date, {
      date,
      value: mean(rows.map(r => convert(r.kilograms, unit))),
      readings: [...rows].sort((a, b) => stamp(a).localeCompare(stamp(b))),
    });
  }
  return result;
}

/**
 * Same definition as analytics.dashboard()'s weight_trend: the mean of the daily
 * means recorded in the seven calendar days ending on `date`; null when none were.
 */
export function trendOn(means: Map<string, DayMean>, date: string): number | null {
  const window = [0, 1, 2, 3, 4, 5, 6]
    .map(i => means.get(daysBefore(date, i)))
    .filter((d): d is DayMean => d !== undefined);
  return window.length ? mean(window.map(d => d.value)) : null;
}

const sourceTone = (source: string) => {
  const name = source.toLowerCase();
  return name.includes("withings")
    ? "withings"
    : name.includes("apple")
      ? "apple"
      : name === "manual"
        ? "manual"
        : "other";
};

function Kpis({
  readings,
  means,
  dates,
  allMeans,
  unit,
}: {
  readings: Weighed[];
  means: DayMean[];
  dates: string[];
  allMeans: Map<string, DayMean>;
  unit: Unit;
}) {
  const latest = latestReading(readings);
  // The trend is anchored on the last day in range that has one, so a quiet
  // final week doesn't blank out the tiles.
  const anchor = [...dates].reverse().find(d => trendOn(allMeans, d) !== null) ?? null;
  const trend = anchor ? trendOn(allMeans, anchor) : null;
  const compare = (days: number) => {
    const before = anchor ? trendOn(allMeans, daysBefore(anchor, days)) : null;
    return trend != null && before != null ? trend - before : null;
  };
  const weekly = compare(7);
  const monthly = compare(30);
  const monthlyBase = trend != null && monthly != null ? trend - monthly : null;
  const low = means.reduce<DayMean | null>((a, d) => (!a || d.value < a.value ? d : a), null);
  const high = means.reduce<DayMean | null>((a, d) => (!a || d.value > a.value ? d : a), null);
  const average = means.length ? mean(means.map(d => d.value)) : null;
  const sigma = average != null ? Math.sqrt(mean(means.map(d => (d.value - average) ** 2))) : null;
  return (
    <div className="qs-kpis qs-kpis-4">
      <Kpi
        lead
        label="latest"
        value={latest ? fixed(convert(latest.kilograms, unit)) : "—"}
        unit={unit}
        meta={
          latest ? (
            <>
              {short(latest.date)}
              {latest.time && ` ${clock(latest)}`} · {fixed(convert(latest.kilograms, other(unit)))}{" "}
              {other(unit)}
              <br />
              <span className="qs-source">{latest.source}</span>
            </>
          ) : (
            "—"
          )
        }
      />
      <Kpi
        label="7-day trend"
        value={fixed(trend)}
        unit={unit}
        meta={
          <>
            smooths daily noise
            <br />
            {weekly != null ? (
              <span className={directionTone(weekly) ? `qs-${directionTone(weekly)}-text` : ""}>
                {Math.abs(weekly) < 0.05
                  ? "→ flat"
                  : `${arrow(weekly)} ${Math.abs(weekly).toFixed(1)}`}{" "}
                / week
              </span>
            ) : (
              "—"
            )}
          </>
        }
      />
      <Kpi
        label="30-day change"
        value={monthly != null ? signed(monthly) : "—"}
        unit={unit}
        tone={directionTone(monthly)}
        meta={
          <>
            trend vs trend
            <br />
            {monthly != null && monthlyBase
              ? `${signed((monthly / monthlyBase) * 100)} %`
              : "needs 30 days of history"}
          </>
        }
      />
      <Kpi
        label="range"
        value={
          low && high ? (
            <>
              {fixed(low.value)}
              <span className="qs-kpi-sep">–</span>
              {fixed(high.value)}
            </>
          ) : (
            "—"
          )
        }
        meta={
          low && high ? (
            <>
              min {short(low.date)} · max {short(high.date)}
              <br />σ {fixed(sigma)} {unit}
            </>
          ) : (
            "—"
          )
        }
      />
    </div>
  );
}

function niceStep(span: number) {
  for (const step of [0.5, 1, 2, 2.5, 3, 5, 10, 20, 25, 50, 100]) if (span / step <= 4) return step;
  return 200;
}

export function WeightChart({
  loading = false,
  dates,
  means,
  allMeans,
  excluded,
  imports,
  unit,
  selected,
  onSelect,
  onReviewExcluded,
}: {
  loading?: boolean;
  dates: string[];
  means: Map<string, DayMean>;
  allMeans: Map<string, DayMean>;
  excluded: Weighed[];
  imports: ImportBatch[];
  unit: Unit;
  selected: string | null;
  onSelect: (date: string) => void;
  onReviewExcluded: (date: string) => void;
}) {
  const [ref, width] = useWidth(1060);
  const gradient = useId();
  const [toggles, setToggles] = useState({ trend: true, individual: false, bySource: false });
  const [hover, setHover] = useState<string | null>(null);
  const [hoverGhost, setHoverGhost] = useState<string | null>(null);
  const height = 230;
  const [top, bottom, left, right] = [16, 200, 44, 8];
  const slot = (width - left - right) / Math.max(dates.length, 1);
  const x = (i: number) => left + slot * (i + 0.5);
  const index = new Map(dates.map((d, i) => [d, i]));
  const days = dates.flatMap((date, i) => (means.has(date) ? [{ i, ...means.get(date)! }] : []));
  const trend = dates.flatMap((date, i) => {
    const value = trendOn(allMeans, date);
    return value == null ? [] : [{ i, value }];
  });
  const values = [
    ...days.map(d => d.value),
    ...(toggles.trend ? trend.map(t => t.value) : []),
    ...(toggles.individual
      ? days.flatMap(d => d.readings.map(r => convert(r.kilograms, unit)))
      : []),
  ];
  const step = values.length ? niceStep(Math.max(...values) - Math.min(...values) + 2) : 1;
  const lo = values.length ? Math.floor((Math.min(...values) - 1) / step) * step : 0;
  const hi = values.length ? Math.ceil((Math.max(...values) + 1) / step) * step : 4;
  const y = scale([lo, hi], [bottom, top]);
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 10) / 10);
  const latest = days[days.length - 1];
  // Excluded readings are drawn as ghosts, but only when they fall inside the
  // plotted scale; a wild glitch shouldn't stretch the axis.
  const ghosts = excluded.flatMap(r => {
    const i = index.get(r.date);
    const value = convert(r.kilograms, unit);
    return i === undefined || value < lo || value > hi ? [] : [{ i, value, reading: r }];
  });
  const markers = imports.flatMap(batch => {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(
      new Date(batch.created_at)
    );
    const i = index.get(date);
    return i === undefined ? [] : [{ i, date, batch }];
  });
  // Neighboring markers share one label so they don't overprint each other.
  const groups: { x: number; items: typeof markers }[] = [];
  for (const m of [...markers].sort((a, b) => a.i - b.i)) {
    const last = groups[groups.length - 1];
    if (last && x(m.i) - last.x < 180) last.items.push(m);
    else groups.push({ x: x(m.i), items: [m] });
  }
  const hovered = hover ? days.find(d => d.date === hover) : undefined;
  const ghost = hoverGhost ? ghosts.find(g => g.reading.uuid === hoverGhost) : undefined;
  const toggle = (key: keyof typeof toggles, label: string) => (
    <Toggle
      on={toggles[key]}
      label={label}
      onClick={() => setToggles({ ...toggles, [key]: !toggles[key] })}
    />
  );
  const locate = (event: React.MouseEvent<SVGRectElement>) =>
    nearest(event, width, days, d => x(d.i));
  let tooltip: React.ReactNode = null;
  if (ghost) {
    const reason = ghost.reading.note || "no reason recorded";
    tooltip = (
      <ChartTooltip
        x={x(ghost.i)}
        y={y(ghost.value)}
        head={`excluded · ${short(ghost.reading.date)} · ${fixed(ghost.value)} ${unit}`}
        body={`${reason.length > 34 ? `${reason.slice(0, 33)}…` : reason} · click to review`}
        width={width}
        left={left}
        right={right}
        top={top}
      />
    );
  } else if (hovered) {
    const dayTrend = trendOn(allMeans, hovered.date);
    const delta = dayTrend != null ? hovered.value - dayTrend : null;
    tooltip = (
      <ChartTooltip
        x={x(hovered.i)}
        y={y(hovered.value)}
        head={`${short(hovered.date)} · ${plural(hovered.readings.length, "reading")}`}
        body={[
          `${fixed(hovered.value)} ${unit}`,
          dayTrend != null && `trend ${fixed(dayTrend)}`,
          delta != null &&
            Math.abs(delta) >= 0.05 &&
            `${arrow(delta)} ${Math.abs(delta).toFixed(1)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        width={width}
        left={left}
        right={right}
        top={top}
      />
    );
  }
  const trendPoints = trend.map(t => ({ x: x(t.i), y: y(t.value) }));
  const legend = [...new Set(days.flatMap(d => d.readings.map(r => r.source)))].sort();
  return (
    <section className="qs-panel qs-bp-chart">
      <div className="qs-panel-head qs-ruled">
        <h2 className="qs-panel-title">Daily means</h2>
        <div className="qs-toggles">
          {toggles.bySource && (
            <span className="qs-source-legend">
              {legend.map(s => (
                <span key={s} className={`qs-source-${sourceTone(s)}`}>
                  <i />
                  {s.toLowerCase()}
                </span>
              ))}
            </span>
          )}
          {toggle("trend", "7-day trend")}
          {toggle("individual", "individual readings")}
          {toggle("bySource", "by source")}
        </div>
      </div>
      <div ref={ref}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          height={height}
          role="img"
          aria-label={`Daily mean weight in ${unit} with seven-day trend`}
          className={toggles.bySource ? "qs-by-source" : undefined}
        >
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" className="qs-stop-weight" stopOpacity="0.22" />
              <stop offset="1" className="qs-stop-weight" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className="qs-grid">
            {ticks.map(t => (
              <line key={t} x1={left} y1={y(t)} x2={width - right} y2={y(t)} />
            ))}
          </g>
          <g className="qs-axis-text">
            {ticks.map(t => (
              <text key={t} x="0" y={y(t) + 4}>
                {Number.isInteger(t) ? t : t.toFixed(1)}
              </text>
            ))}
            {dateTicks(dates).map((i, n, list) => (
              <text
                key={i}
                x={x(i)}
                y={height - 6}
                textAnchor={n === 0 ? "start" : n === list.length - 1 ? "end" : "middle"}
              >
                {short(dates[i])}
              </text>
            ))}
            {!days.length && !loading && (
              <text
                className="qs-chart-empty"
                x={(left + width) / 2}
                y={(top + bottom) / 2}
                textAnchor="middle"
              >
                no readings in this range
              </text>
            )}
          </g>
          <g className="qs-import-markers">
            {groups.map(group => (
              <g key={group.items[0].batch.uuid}>
                {group.items.map(m => (
                  <line key={m.batch.uuid} x1={x(m.i)} x2={x(m.i)} y1={top - 6} y2={bottom} />
                ))}
                <text
                  x={group.x + (group.x > width - 200 ? -6 : 6)}
                  y={top + 4}
                  textAnchor={group.x > width - 200 ? "end" : "start"}
                >
                  {group.items.length === 1
                    ? `${group.items[0].batch.source.toLowerCase()} import · ${short(group.items[0].date)}`
                    : `${group.items.length} imports · ${[
                        ...new Set([group.items[0].date, group.items[group.items.length - 1].date]),
                      ]
                        .map(short)
                        .join("–")}`}
                </text>
              </g>
            ))}
          </g>
          {toggles.trend && trendPoints.length > 0 && (
            <>
              <path
                fill={`url(#${gradient})`}
                d={`${line(trendPoints)} L${trendPoints[trendPoints.length - 1].x.toFixed(1)},${bottom} L${trendPoints[0].x.toFixed(1)},${bottom} Z`}
              />
              <path className="qs-trend qs-trend-detail" d={line(trendPoints)} />
            </>
          )}
          {toggles.individual && (
            <g className="qs-dot-individual qs-dot-individual-weight">
              {days.flatMap(d =>
                d.readings.map(r => (
                  <circle
                    key={r.uuid}
                    className={`qs-source-${sourceTone(r.source)}`}
                    cx={x(d.i)}
                    cy={y(convert(r.kilograms, unit))}
                    r="2.5"
                  />
                ))
              )}
            </g>
          )}
          <g className="qs-ghosts">
            {ghosts.map(g => (
              <g
                key={g.reading.uuid}
                role="button"
                tabIndex={0}
                aria-label={`Excluded reading ${g.reading.date}; review in table`}
                onMouseEnter={() => setHoverGhost(g.reading.uuid)}
                onMouseLeave={() => setHoverGhost(null)}
                onFocus={() => setHoverGhost(g.reading.uuid)}
                onBlur={() => setHoverGhost(null)}
                onClick={() => onReviewExcluded(g.reading.date)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onReviewExcluded(g.reading.date);
                  }
                }}
              >
                <circle cx={x(g.i)} cy={y(g.value)} r="3.5" />
                {ghosts.length <= 3 && (
                  <text x={x(g.i) + 8} y={y(g.value) + 3}>
                    excluded · {short(g.reading.date)}
                  </text>
                )}
              </g>
            ))}
          </g>
          {days.length > 0 && (
            <rect
              className="qs-hit"
              x={left}
              y={top}
              width={width - left - right}
              height={bottom - top}
              onMouseMove={e => setHover(locate(e)?.date ?? null)}
              onMouseLeave={() => setHover(null)}
              onClick={e => {
                const day = locate(e);
                if (day) onSelect(day.date);
              }}
            />
          )}
          <g className="qs-dot-weight qs-clickable">
            {days.map(d => (
              <g
                key={d.date}
                role="button"
                tabIndex={0}
                aria-label={`${d.date}: ${fixed(d.value)} ${unit}; show readings`}
                aria-pressed={selected === d.date}
                className={d === latest ? "qs-latest" : undefined}
                onMouseEnter={() => setHover(d.date)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(d.date)}
                onBlur={() => setHover(null)}
                onClick={() => onSelect(d.date)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(d.date);
                  }
                }}
              >
                <circle
                  className={`qs-source-${sourceTone(d.readings[d.readings.length - 1].source)}`}
                  cx={x(d.i)}
                  cy={y(d.value)}
                  r={d === latest ? 4.5 : 3.5}
                />
              </g>
            ))}
          </g>
          {tooltip}
        </svg>
      </div>
      <p className="qs-muted qs-bp-footnote">
        Points are daily means of included readings; the dashed line averages the daily means of the
        last seven calendar days. Select a day to filter the table.
      </p>
    </section>
  );
}

export default function Weight({
  root,
  start,
  end,
  unit,
  revision,
  onRange,
  onUnit,
  onAdd,
  onEdit,
  onChanged,
}: {
  root: string;
  start: string;
  end: string;
  unit: Unit;
  revision: number;
  onRange: (start: string, end: string) => void;
  onUnit: (unit: Unit) => void;
  onAdd: () => void;
  onEdit: (row: Reading) => void;
  onChanged: () => void;
}) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const [imports, setImports] = useState<ImportBatch[]>([]);
  // The trend and 30-day change need daily means from before the range starts;
  // the API caps any request at ten years.
  const fetchStart = [daysBefore(start, 37), daysBefore(end, ALL_DAYS)].sort()[1];
  const query = new URLSearchParams({ start, end }).toString();
  const { rows, error, remove, restore } = useRecords(
    root,
    "weight",
    new URLSearchParams({ start: fetchStart, end }).toString(),
    revision,
    onChanged
  );
  useEffect(() => setSelectedDay(null), [query]);
  useEffect(() => {
    let active = true;
    api<ImportBatch[]>(`${root}imports/`)
      .then(batches => {
        if (active)
          setImports(
            batches.filter(b => b.committed && (b.kind === "weight" || b.kind === "apple-health"))
          );
      })
      // Import markers are decoration; the page works without them.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [root, revision]);
  const all = useMemo(() => (rows ?? []).filter((r): r is Weighed => r.kilograms != null), [rows]);
  const inRange = useMemo(
    () => all.filter(r => r.date >= start && r.date <= end),
    [all, start, end]
  );
  const included = useMemo(() => all.filter(r => !r.excluded), [all]);
  const readings = useMemo(() => inRange.filter(r => !r.excluded), [inRange]);
  const allMeans = useMemo(() => dailyMeans(included, unit), [included, unit]);
  const means = useMemo(() => dailyMeans(readings, unit), [readings, unit]);
  const first = readings.reduce<string | null>(
    (min, r) => (!min || r.date < min ? r.date : min),
    null
  );
  const dates = datesBetween(rangePreset(start, end) === ALL_DAYS && first ? first : start, end);
  const rangeDates = datesBetween(start, end);
  const metrics: Metric[] = [unit, other(unit)].map((u, n) => ({
    key: u,
    label: u,
    sort: r => r.kilograms ?? -1,
    render: r => (r.kilograms == null ? "—" : convert(r.kilograms, u).toFixed(1)),
    className: () => (n === 0 ? "qs-strong" : ""),
  }));
  const delta = (r: Reading) => {
    const trend = trendOn(allMeans, r.date);
    return r.excluded || r.kilograms == null || trend == null
      ? null
      : convert(r.kilograms, unit) - trend;
  };
  metrics.push({
    key: "delta",
    label: "Δ trend",
    sort: r => delta(r) ?? -Infinity,
    render: r => {
      const value = delta(r);
      return value == null ? "—" : signed(value);
    },
    className: r => {
      const value = delta(r);
      return value == null || Math.abs(value) < 0.05
        ? "qs-delta-flat"
        : value < 0
          ? "qs-ok-text"
          : "qs-danger-text";
    },
  });
  const flag = (r: Reading): Flag | null =>
    r.time && r.time >= "12:00" ? { label: "pm", tone: "neutral" } : null;
  return (
    <>
      <StatusLine
        start={start}
        end={end}
        loaded={rows !== null}
        readings={readings.length}
        days={means.size}
        excluded={inRange.filter(r => r.excluded).length}
        sources={[...new Set(readings.map(r => r.source))].sort()}
        extra={
          <>
            {" "}
            · unit <b>{unit}</b>
          </>
        }
        controls={
          <select
            className="qs-unit-select"
            aria-label="Display unit"
            value={unit}
            onChange={e => onUnit(e.target.value as Unit)}
          >
            <option value="lb">lb</option>
            <option value="kg">kg</option>
          </select>
        }
        onRange={onRange}
        onAdd={onAdd}
      />
      {error && (
        <p className="qs-error" role="alert">
          {error}
        </p>
      )}
      <Kpis
        readings={readings}
        means={[...means.values()]}
        dates={rangeDates}
        allMeans={allMeans}
        unit={unit}
      />
      <WeightChart
        loading={rows === null}
        dates={dates}
        means={means}
        allMeans={allMeans}
        excluded={inRange.filter(r => r.excluded)}
        imports={imports}
        unit={unit}
        selected={selectedDay}
        onSelect={day => {
          setSelectedDay(selectedDay === day ? null : day);
          scrollToReadings();
        }}
        onReviewExcluded={day => {
          setSelectedDay(day);
          setShowExcluded(true);
          scrollToReadings();
        }}
      />
      <ReadingsTable
        loading={rows === null}
        kind="weight"
        title="Weight readings"
        rows={inRange}
        root={root}
        exportQuery={query}
        metrics={metrics}
        flag={flag}
        showExcluded={showExcluded}
        onShowExcluded={setShowExcluded}
        selectedDay={selectedDay}
        onClearDay={() => setSelectedDay(null)}
        onEdit={onEdit}
        onDelete={remove}
        onRestore={restore}
      />
    </>
  );
}
