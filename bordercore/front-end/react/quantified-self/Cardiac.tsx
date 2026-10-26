import React, { useEffect, useMemo, useState } from "react";
import { daysBefore } from "./api";
import { dateTicks, line, scale, useWidth } from "./chart";
import {
  ALL_DAYS,
  ChartTooltip,
  Kpi,
  Metric,
  ReadingsTable,
  StatusLine,
  Toggle,
  datesBetween,
  latestReading,
  mean,
  nearest,
  plural,
  rangePreset,
  scrollToReadings,
  short,
  useRecords,
} from "./Ledger";
import { CardiacKind, Reading, cardiacMetrics } from "./types";

type DayMean = { date: string; value: number; readings: Reading[] };
const fixed = (value: number | null | undefined) => (value == null ? "—" : value.toFixed(1));
const signed = (value: number | null) =>
  value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

export function cardiacDailyMeans(readings: Reading[]): Map<string, DayMean> {
  const groups = new Map<string, Reading[]>();
  for (const row of readings) {
    if (row.excluded || row.value == null) continue;
    const group = groups.get(row.date) ?? [];
    group.push(row);
    groups.set(row.date, group);
  }
  return new Map(
    [...groups].map(([date, rows]) => [
      date,
      {
        date,
        value: mean(rows.map(r => Number(r.value))),
        readings: rows,
      },
    ])
  );
}

export function cardiacTrend(means: Map<string, DayMean>, date: string): number | null {
  const values = Array.from({ length: 7 }, (_, i) => means.get(daysBefore(date, i))?.value).filter(
    (v): v is number => v !== undefined
  );
  return values.length ? mean(values) : null;
}

function CardiacChart({
  kind,
  dates,
  means,
  allMeans,
  loading,
  selected,
  onSelect,
}: {
  kind: CardiacKind;
  dates: string[];
  means: Map<string, DayMean>;
  allMeans: Map<string, DayMean>;
  loading: boolean;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const { unit, label } = cardiacMetrics[kind];
  const [ref, width] = useWidth(1060);
  const [hover, setHover] = useState<string | null>(null);
  const [trendVisible, setTrendVisible] = useState(true);
  const [individual, setIndividual] = useState(false);
  const [left, right, top, bottom, height] = [48, 12, 20, 200, 230];
  const x = (i: number) => left + ((width - left - right) * (i + 0.5)) / Math.max(dates.length, 1);
  const days = dates.flatMap((date, i) => (means.has(date) ? [{ ...means.get(date)!, i }] : []));
  const trends = dates.flatMap((date, i) => {
    const value = cardiacTrend(allMeans, date);
    return value == null ? [] : [{ value, i }];
  });
  const values = [
    ...days.map(d => d.value),
    ...(trendVisible ? trends.map(t => t.value) : []),
    ...(individual ? days.flatMap(d => d.readings.map(r => Number(r.value))) : []),
  ];
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 100;
  const padding = Math.max(1, (high - low) * 0.15);
  const lo = Math.max(0, low - padding),
    hi = high + padding;
  const y = scale([lo, hi], [bottom, top]);
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const hovered = days.find(d => d.date === hover);
  const locate = (event: React.MouseEvent<SVGRectElement>) =>
    nearest(event, width, days, d => x(d.i));
  return (
    <section className="qs-panel qs-bp-chart">
      <div className="qs-panel-head qs-ruled">
        <h2 className="qs-panel-title">Daily means</h2>
        <div className="qs-toggles">
          <Toggle
            label="7-day trend"
            on={trendVisible}
            onClick={() => setTrendVisible(!trendVisible)}
          />
          <Toggle
            label="individual readings"
            on={individual}
            onClick={() => setIndividual(!individual)}
          />
        </div>
      </div>
      <div ref={ref}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          height={height}
          role="img"
          aria-label={`Daily mean ${label.toLowerCase()} in ${unit} with seven-day trend`}
        >
          <g className="qs-grid">
            {ticks.map(t => (
              <line key={t} x1={left} x2={width - right} y1={y(t)} y2={y(t)} />
            ))}
          </g>
          <g className="qs-axis-text">
            {ticks.map(t => (
              <text key={t} x="0" y={y(t) + 4}>
                {fixed(t)}
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
            {!days.length && (
              <text x={(left + width) / 2} y="110" textAnchor="middle">
                {loading ? "Loading…" : "no readings in this range"}
              </text>
            )}
          </g>
          {trendVisible && (
            <path
              className="qs-cardiac-trend"
              d={line(trends.map(t => ({ x: x(t.i), y: y(t.value) })))}
            />
          )}
          {individual && (
            <g className="qs-cardiac-individual">
              {days.flatMap(d =>
                d.readings.map(r => (
                  <circle key={r.uuid} cx={x(d.i)} cy={y(Number(r.value))} r="2.5" />
                ))
              )}
            </g>
          )}
          <rect
            className="qs-hit"
            x={left}
            y={top}
            width={Math.max(0, width - left - right)}
            height={bottom - top}
            onMouseMove={e => setHover(locate(e)?.date ?? null)}
            onMouseLeave={() => setHover(null)}
            onClick={e => {
              const day = locate(e);
              if (day) onSelect(day.date);
            }}
          />
          <g className="qs-cardiac-dots">
            {days.map(d => (
              <circle
                key={d.date}
                cx={x(d.i)}
                cy={y(d.value)}
                r={d.date === selected ? 5 : 3.5}
                role="button"
                tabIndex={0}
                aria-pressed={d.date === selected}
                aria-label={`${d.date}: ${fixed(d.value)} ${unit}; show readings`}
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
              />
            ))}
          </g>
          {hovered && (
            <ChartTooltip
              x={x(hovered.i)}
              y={y(hovered.value)}
              head={`${hovered.date} · ${plural(hovered.readings.length, "reading")}`}
              body={`${fixed(hovered.value)} ${unit} · trend ${fixed(cardiacTrend(allMeans, hovered.date))}`}
              width={width}
              left={left}
              right={right}
              top={top}
            />
          )}
        </svg>
      </div>
      <div className="qs-panel-foot">
        Daily averages · trend averages the recorded daily means in the preceding seven calendar
        days, including today. Missing days are not zero. Click a day to filter the readings below.
      </div>
    </section>
  );
}

export default function Cardiac({
  kind,
  root,
  start,
  end,
  revision,
  onRange,
  onAdd,
  onEdit,
  onChanged,
}: {
  kind: CardiacKind;
  root: string;
  start: string;
  end: string;
  revision: number;
  onRange: (start: string, end: string) => void;
  onAdd: () => void;
  onEdit: (row: Reading) => void;
  onChanged: () => void;
}) {
  const { label, unit } = cardiacMetrics[kind];
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const query = new URLSearchParams({ start, end }).toString();
  const fetchStart = [daysBefore(start, 37), daysBefore(end, ALL_DAYS)].sort()[1];
  const { rows, error, remove, restore } = useRecords(
    root,
    kind,
    new URLSearchParams({ start: fetchStart, end }).toString(),
    revision,
    onChanged
  );
  useEffect(() => setSelectedDay(null), [query, kind]);
  const inRange = useMemo(
    () => (rows ?? []).filter(r => r.date >= start && r.date <= end),
    [rows, start, end]
  );
  const included = useMemo(() => inRange.filter(r => !r.excluded), [inRange]);
  const allMeans = useMemo(() => cardiacDailyMeans(rows ?? []), [rows]);
  const means = useMemo(() => cardiacDailyMeans(inRange), [inRange]);
  const first = [...means.keys()].sort()[0];
  const dates = datesBetween(rangePreset(start, end) === ALL_DAYS && first ? first : start, end);
  const latest = latestReading(included);
  const anchor = [...dates].reverse().find(d => cardiacTrend(allMeans, d) !== null);
  const trend = anchor ? cardiacTrend(allMeans, anchor) : null;
  const before = anchor ? cardiacTrend(allMeans, daysBefore(anchor, 30)) : null;
  const change = trend != null && before != null ? trend - before : null;
  const values = [...means.values()].map(d => d.value);
  const metrics: Metric[] = [
    {
      key: "value",
      label: unit,
      sort: r => Number(r.value),
      render: r => fixed(Number(r.value)),
      className: () => "qs-strong",
    },
  ];
  return (
    <>
      <StatusLine
        start={start}
        end={end}
        loaded={rows !== null}
        readings={included.length}
        days={means.size}
        excluded={inRange.length - included.length}
        sources={[...new Set(included.map(r => r.source))].sort()}
        extra={<> · {kind === "hrv" ? "SDNN · ms" : "bpm"}</>}
        onRange={onRange}
        onAdd={onAdd}
      />
      {error && (
        <p className="qs-error" role="alert">
          {error}
        </p>
      )}
      <div className="qs-kpis qs-kpis-4">
        <Kpi
          lead
          label="latest"
          value={latest ? fixed(Number(latest.value)) : "—"}
          unit={unit}
          meta={
            latest ? (
              <>
                {latest.date} {latest.time?.slice(0, 5)}
                <br />
                <span className="qs-source">{latest.source}</span>
              </>
            ) : (
              "no readings in this range"
            )
          }
        />
        <Kpi
          label="7-day trend"
          value={fixed(trend)}
          unit={unit}
          meta={
            anchor ? (
              <>
                daily means
                <br />
                as of {anchor}
              </>
            ) : (
              "—"
            )
          }
        />
        <Kpi
          label="30-day change"
          value={signed(change)}
          unit={unit}
          meta={change == null ? "needs 30 days of history" : "trend vs trend"}
        />
        <Kpi
          label="range"
          value={
            values.length ? `${fixed(Math.min(...values))}–${fixed(Math.max(...values))}` : "—"
          }
          unit={unit}
          meta="minimum and maximum daily means"
        />
      </div>
      <CardiacChart
        kind={kind}
        dates={dates}
        means={means}
        allMeans={allMeans}
        loading={rows === null}
        selected={selectedDay}
        onSelect={day => {
          setSelectedDay(selectedDay === day ? null : day);
          scrollToReadings();
        }}
      />
      <ReadingsTable
        loading={rows === null}
        kind={kind}
        title={`${label} readings`}
        rows={inRange}
        root={root}
        exportQuery={query}
        metrics={metrics}
        flag={() => null}
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
