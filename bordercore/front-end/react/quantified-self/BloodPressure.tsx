import React, { useEffect, useMemo, useState } from "react";
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

// ACC/AHA single-reading categories. Descriptive only, never diagnostic.
export type Category = "normal" | "elevated" | "stage 1" | "stage 2";
export function category(systolic: number, diastolic: number): Category {
  if (systolic >= 140 || diastolic >= 90) return "stage 2";
  if (systolic >= 130 || diastolic >= 80) return "stage 1";
  if (systolic >= 120) return "elevated";
  return "normal";
}
const categoryTone = (value: Category) =>
  value === "normal" ? "ok" : value === "stage 2" ? "danger" : "warn";

type Pressure = Reading & { systolic: number; diastolic: number };
type DayMean = {
  date: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  readings: Pressure[];
};
function dailyMeans(readings: Pressure[]): Map<string, DayMean> {
  const byDay = new Map<string, Pressure[]>();
  for (const r of readings) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
  const result = new Map<string, DayMean>();
  for (const [date, rows] of byDay) {
    const pulses = rows.map(r => r.pulse).filter((p): p is number => p != null);
    result.set(date, {
      date,
      systolic: mean(rows.map(r => r.systolic)),
      diastolic: mean(rows.map(r => r.diastolic)),
      pulse: pulses.length ? mean(pulses) : null,
      // Oldest first, so the tooltip's "first note" is the day's earliest.
      readings: [...rows].sort((a, b) => stamp(a).localeCompare(stamp(b))),
    });
  }
  return result;
}

const pair = (a: number | null | undefined, b: number | null | undefined, sep = "/") =>
  a == null || b == null ? (
    "—"
  ) : (
    <>
      {Math.round(a)}
      <span className="qs-kpi-sep">{sep}</span>
      {Math.round(b)}
    </>
  );

function Kpis({ readings, means }: { readings: Pressure[]; means: DayMean[] }) {
  const latest = latestReading(readings);
  const extreme = (key: "systolic" | "diastolic", pick: (a: number, b: number) => boolean) =>
    readings.reduce<Pressure | null>(
      (best, r) => (!best || pick(r[key], best[key]) ? r : best),
      null
    );
  const sysMin = extreme("systolic", (a, b) => a < b);
  const sysMax = extreme("systolic", (a, b) => a > b);
  const diaMin = extreme("diastolic", (a, b) => a < b);
  const diaMax = extreme("diastolic", (a, b) => a > b);
  const meanSys = means.length ? mean(means.map(d => d.systolic)) : null;
  const meanDia = means.length ? mean(means.map(d => d.diastolic)) : null;
  const rangeCategory = meanSys != null && meanDia != null ? category(meanSys, meanDia) : null;
  const pulses = readings.map(r => r.pulse).filter((p): p is number => p != null);
  const highSys = readings.filter(r => r.systolic >= 130).length;
  const highDia = readings.filter(r => r.diastolic >= 80).length;
  return (
    <div className="qs-kpis">
      <Kpi
        lead
        label="latest"
        value={pair(latest?.systolic, latest?.diastolic)}
        meta={
          latest ? (
            <>
              {short(latest.date)}
              {latest.time && ` ${clock(latest)}`}
              {latest.pulse != null && ` · pulse ${latest.pulse}`}
              <br />
              <span className="qs-source">{latest.source}</span>
            </>
          ) : (
            "—"
          )
        }
      />
      <Kpi
        label="range mean"
        value={pair(meanSys, meanDia)}
        meta={
          <>
            of daily means · {plural(means.length, "day")}
            <br />
            {rangeCategory ? (
              <span className={`qs-${categoryTone(rangeCategory)}-text`}>{rangeCategory}</span>
            ) : (
              "—"
            )}
          </>
        }
      />
      <Kpi
        label="systolic span"
        value={pair(sysMin?.systolic, sysMax?.systolic, "–")}
        meta={
          sysMin && sysMax ? (
            <>
              min {short(sysMin.date)} · max {short(sysMax.date)}
              <br />
              {plural(highSys, "reading")} ≥ 130
            </>
          ) : (
            "—"
          )
        }
      />
      <Kpi
        label="diastolic span"
        value={pair(diaMin?.diastolic, diaMax?.diastolic, "–")}
        meta={
          diaMin && diaMax ? (
            <>
              min {short(diaMin.date)} · max {short(diaMax.date)}
              <br />
              {plural(highDia, "reading")} ≥ 80
            </>
          ) : (
            "—"
          )
        }
      />
      <Kpi
        label="pulse"
        value={pulses.length ? Math.round(mean(pulses)) : "—"}
        unit="bpm"
        meta={
          pulses.length ? (
            <>
              mean · {Math.min(...pulses)}–{Math.max(...pulses)}
              <br />
              {pulses.length} of {plural(readings.length, "reading")}
            </>
          ) : (
            "—"
          )
        }
      />
    </div>
  );
}

const BANDS: { from: number; to: number; label: string; className: string }[] = [
  { from: 140, to: Infinity, label: "stage 2 ≥140", className: "qs-ref-stage2" },
  { from: 130, to: 140, label: "stage 1 130–139", className: "qs-ref-stage1" },
  { from: 120, to: 130, label: "elevated 120–129", className: "qs-ref-elevated" },
  { from: 90, to: 120, label: "normal <120", className: "qs-ref-normal" },
];

export function DailyChart({
  loading = false,
  dates,
  means,
  selected,
  onSelect,
}: {
  loading?: boolean;
  dates: string[];
  means: Map<string, DayMean>;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const [ref, width] = useWidth(1060);
  const [toggles, setToggles] = useState({ bands: true, pulse: false, individual: false });
  const [hover, setHover] = useState<string | null>(null);
  const height = 230;
  const [top, bottom, left, right] = [10, 200, 44, 8];
  const days = dates.flatMap((date, i) => (means.has(date) ? [{ i, ...means.get(date)! }] : []));
  const all = days.flatMap(d => d.readings);
  const lo = Math.min(60, ...all.map(r => Math.floor((r.diastolic - 5) / 10) * 10));
  const hi = Math.max(150, ...all.map(r => Math.ceil((r.systolic + 5) / 10) * 10));
  const y = scale([lo, hi], [bottom, top]);
  const slot = (width - left - right) / Math.max(dates.length, 1);
  const x = (i: number) => left + slot * (i + 0.5);
  const systolic = days.map(d => ({ x: x(d.i), y: y(d.systolic), day: d }));
  const diastolic = days.map(d => ({ x: x(d.i), y: y(d.diastolic), day: d }));
  const peak = days.reduce<(typeof days)[number] | null>(
    (best, d) => (!best || d.systolic > best.systolic ? d : best),
    null
  );
  const pulses = days.filter(d => d.pulse != null);
  const pulseY = pulses.length
    ? scale(
        [Math.min(...pulses.map(d => d.pulse!)) - 5, Math.max(...pulses.map(d => d.pulse!)) + 5],
        [bottom - 10, top + 10]
      )
    : null;
  const ticks = [];
  for (let t = Math.ceil(lo / 30) * 30; t <= hi; t += 30) ticks.push(t);
  const hovered = hover ? days.find(d => d.date === hover) : undefined;
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
  if (hovered) {
    const note = hovered.readings.find(r => r.note)?.note ?? "";
    const head = `${short(hovered.date)} · ${plural(hovered.readings.length, "reading")} · ${category(hovered.systolic, hovered.diastolic)}`;
    const clipped = note.length > 32 ? `${note.slice(0, 31)}…` : note;
    const body = [
      `${Math.round(hovered.systolic)} / ${Math.round(hovered.diastolic)}`,
      hovered.pulse != null && `pulse ${Math.round(hovered.pulse)}`,
      clipped,
    ]
      .filter(Boolean)
      .join(" · ");
    tooltip = (
      <ChartTooltip
        x={x(hovered.i)}
        y={y(hovered.systolic)}
        head={head}
        body={body}
        width={width}
        left={left}
        right={right}
        top={top}
      />
    );
  }
  return (
    <section className="qs-panel qs-bp-chart">
      <div className="qs-panel-head qs-ruled">
        <h2 className="qs-panel-title">Daily means</h2>
        <div className="qs-toggles">
          {toggle("bands", "reference bands")}
          {toggle("pulse", "pulse")}
          {toggle("individual", "individual readings")}
        </div>
      </div>
      <div ref={ref}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          height={height}
          role="img"
          aria-label="Daily mean systolic and diastolic blood pressure with reference bands"
        >
          {toggles.bands && (
            <g className="qs-ref-bands">
              {BANDS.map(band => {
                const y0 = y(Math.min(band.to, hi));
                const y1 = y(Math.max(band.from, lo));
                return (
                  <g key={band.label} className={band.className}>
                    <rect x={left} y={y0} width={width - left - right} height={y1 - y0} />
                    <text x={width - right - 6} y={y0 + 12} textAnchor="end">
                      {band.label}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
          <g className="qs-grid">
            {ticks.map(t => (
              <line key={t} x1={left} y1={y(t)} x2={width - right} y2={y(t)} />
            ))}
          </g>
          <g className="qs-axis-text">
            {ticks.map(t => (
              <text key={t} x="0" y={y(t) + 4}>
                {t}
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
          {days.length > 0 && (
            <>
              <path
                className="qs-band"
                d={`${line(systolic)} ${line([...diastolic].reverse()).replace(/^M/, "L")} Z`}
              />
              <path className="qs-line-systolic qs-thick" d={line(systolic)} />
              <path className="qs-line-diastolic qs-thick" d={line(diastolic)} />
            </>
          )}
          {toggles.pulse && pulseY && (
            <path
              className="qs-line-pulse"
              d={line(pulses.map(d => ({ x: x(d.i), y: pulseY(d.pulse!) })))}
            />
          )}
          {toggles.individual && (
            <g className="qs-dot-individual">
              {days.flatMap(d =>
                d.readings.flatMap(r => [
                  <circle key={`${r.uuid}-s`} cx={x(d.i)} cy={y(r.systolic)} r="2.5" />,
                  <circle key={`${r.uuid}-d`} cx={x(d.i)} cy={y(r.diastolic)} r="2.5" />,
                ])
              )}
            </g>
          )}
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
          <g className="qs-dot-pressure qs-clickable">
            {days.map((d, n) => (
              <g
                key={d.date}
                role="button"
                tabIndex={0}
                aria-label={`${d.date}: ${Math.round(d.systolic)}/${Math.round(d.diastolic)} mmHg; show readings`}
                aria-pressed={selected === d.date}
                className={d === peak ? "qs-peak" : undefined}
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
                <circle cx={systolic[n].x} cy={systolic[n].y} r={d === peak ? 4.5 : 3.5} />
                <circle className="qs-faint" cx={diastolic[n].x} cy={diastolic[n].y} r="3.5" />
              </g>
            ))}
          </g>
          {tooltip}
        </svg>
      </div>
      <p className="qs-muted qs-bp-footnote">
        Points are daily means of included readings; select a day to filter the table. Categories
        follow ACC/AHA single-reading thresholds and are descriptive, not diagnostic.
      </p>
    </section>
  );
}

const pressureMetrics: Metric[] = [
  {
    key: "systolic",
    label: "systolic",
    sort: r => r.systolic ?? -1,
    render: r => r.systolic,
    className: () => "qs-strong qs-tinted",
  },
  {
    key: "diastolic",
    label: "diastolic",
    sort: r => r.diastolic ?? -1,
    render: r => r.diastolic,
    className: () => "qs-strong qs-tinted",
  },
  { key: "pulse", label: "pulse", sort: r => r.pulse ?? -1, render: r => r.pulse ?? "—" },
];
function pressureFlag(row: Reading): Flag | null {
  const level = category(row.systolic ?? 0, row.diastolic ?? 0);
  return level === "normal"
    ? null
    : { label: level, tone: level === "stage 2" ? "danger" : "warn" };
}

export default function BloodPressure({
  root,
  start,
  end,
  revision,
  onRange,
  onAdd,
  onEdit,
  onChanged,
}: {
  root: string;
  start: string;
  end: string;
  revision: number;
  onRange: (start: string, end: string) => void;
  onAdd: () => void;
  onEdit: (row: Reading) => void;
  onChanged: () => void;
}) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const query = new URLSearchParams({ start, end }).toString();
  const { rows, error, remove, restore } = useRecords(
    root,
    "blood-pressure",
    query,
    revision,
    onChanged
  );
  useEffect(() => setSelectedDay(null), [query]);
  const readings = useMemo(
    () =>
      (rows ?? []).filter(
        (r): r is Pressure => !r.excluded && r.systolic != null && r.diastolic != null
      ),
    [rows]
  );
  const means = useMemo(() => dailyMeans(readings), [readings]);
  // A ten-year "all" range would squeeze readings into one corner; start the chart at the first one.
  const first = readings.reduce<string | null>(
    (min, r) => (!min || r.date < min ? r.date : min),
    null
  );
  const dates = datesBetween(rangePreset(start, end) === ALL_DAYS && first ? first : start, end);
  return (
    <>
      <StatusLine
        start={start}
        end={end}
        loaded={rows !== null}
        readings={readings.length}
        days={means.size}
        excluded={(rows ?? []).filter(r => r.excluded).length}
        sources={[...new Set(readings.map(r => r.source))].sort()}
        onRange={onRange}
        onAdd={onAdd}
      />
      {error && (
        <p className="qs-error" role="alert">
          {error}
        </p>
      )}
      <Kpis readings={readings} means={[...means.values()]} />
      <DailyChart
        loading={rows === null}
        dates={dates}
        means={means}
        selected={selectedDay}
        onSelect={day => {
          setSelectedDay(selectedDay === day ? null : day);
          scrollToReadings();
        }}
      />
      <ReadingsTable
        loading={rows === null}
        kind="blood-pressure"
        title="Blood pressure readings"
        rows={rows ?? []}
        root={root}
        exportQuery={query}
        metrics={pressureMetrics}
        flag={pressureFlag}
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
