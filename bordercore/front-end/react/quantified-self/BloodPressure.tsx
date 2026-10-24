import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencilAlt, faPlus, faSearch, faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import { api, daysBefore, errorText, today } from "./api";
import { dateTicks, line, scale, useWidth } from "./chart";
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
type SortColumn = "date" | "time" | "systolic" | "diastolic" | "pulse" | "source";

export const BP_RANGES: [number, string][] = [
  [30, "30d"],
  [90, "90d"],
  [365, "1y"],
  // The API caps a range at ten years, which stands in for "all".
  [3660, "all"],
];
const PAGE = 20;
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const short = (date: string) => date.slice(5);
const clock = (reading: Reading) => (reading.time ? reading.time.slice(0, 5) : "");
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
const stamp = (r: Reading) => `${r.date} ${r.time || ""}`;

function datesBetween(start: string, end: string) {
  const dates: string[] = [];
  for (let day = start; day <= end && dates.length <= 3660; day = daysBefore(day, -1)) {
    dates.push(day);
  }
  return dates;
}

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

function Kpi({
  label,
  value,
  meta,
  lead = false,
}: {
  label: string;
  value: React.ReactNode;
  meta: React.ReactNode;
  lead?: boolean;
}) {
  return (
    <div className={`qs-kpi${lead ? " qs-kpi-lead" : ""}`}>
      <div className="qs-kpi-label">{label}</div>
      <div className="qs-kpi-value">{value}</div>
      <div className="qs-kpi-meta">{meta}</div>
    </div>
  );
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
  const latest = readings.reduce<Pressure | null>(
    (best, r) => (!best || stamp(r) > stamp(best) ? r : best),
    null
  );
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
            "no readings"
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
        value={
          pulses.length ? (
            <>
              {Math.round(mean(pulses))}
              <span className="qs-kpi-unit">bpm</span>
            </>
          ) : (
            "—"
          )
        }
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
  dates,
  means,
  selected,
  onSelect,
}: {
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
    <button
      className={`qs-toggle${toggles[key] ? " on" : ""}`}
      aria-pressed={toggles[key]}
      onClick={() => setToggles({ ...toggles, [key]: !toggles[key] })}
    >
      {toggles[key] ? "●" : "○"} {label}
    </button>
  );
  function locate(event: React.MouseEvent<SVGRectElement>) {
    const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((event.clientX - box.left) / (box.width || width)) * width;
    let best: (typeof days)[number] | null = null;
    for (const d of days) if (!best || Math.abs(x(d.i) - px) < Math.abs(x(best.i) - px)) best = d;
    return best;
  }
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
    const boxWidth = Math.max(head.length * 6.2, body.length * 6.1) + 24;
    const px = x(hovered.i);
    const py = y(hovered.systolic);
    const tx = Math.min(Math.max(px - boxWidth / 2, left), width - right - boxWidth);
    const ty = py - 58 < top ? py + 14 : py - 58;
    tooltip = (
      <g
        className="qs-tooltip qs-tooltip-pink"
        transform={`translate(${tx},${ty})`}
        pointerEvents="none"
      >
        <rect width={boxWidth} height="46" rx="8" />
        <text className="qs-tooltip-head" x="12" y="18">
          {head}
        </text>
        <text className="qs-tooltip-body" x="12" y="35">
          {body}
        </text>
      </g>
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
            {!days.length && (
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

function ReadingsTable({
  rows,
  root,
  exportQuery,
  selectedDay,
  onClearDay,
  onEdit,
  onDelete,
  onRestore,
}: {
  rows: Reading[];
  root: string;
  exportQuery: string;
  selectedDay: string | null;
  onClearDay: () => void;
  onEdit: (row: Reading) => void;
  onDelete: (row: Reading) => void;
  onRestore: (row: Reading) => void;
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [showExcluded, setShowExcluded] = useState(false);
  const [sort, setSort] = useState<{ col: SortColumn; dir: 1 | -1 }>({ col: "date", dir: -1 });
  const [visible, setVisible] = useState(PAGE);
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim().toLowerCase()), 200);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => setVisible(PAGE), [query, source, showExcluded, selectedDay, sort]);
  const sources = [...new Set(rows.map(r => r.source))].sort();
  const excludedCount = rows.filter(r => r.excluded).length;
  const filtered = rows
    .filter(
      r =>
        (showExcluded || !r.excluded) &&
        (!source || r.source === source) &&
        (!selectedDay || r.date === selectedDay) &&
        (!query || r.note.toLowerCase().includes(query))
    )
    .sort((a, b) => {
      const key = (r: Reading): string | number =>
        sort.col === "date"
          ? stamp(r)
          : sort.col === "time"
            ? r.time || ""
            : sort.col === "source"
              ? r.source.toLowerCase()
              : (r[sort.col] ?? -1);
      const [ka, kb] = [key(a), key(b)];
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * sort.dir;
    });
  const shown = filtered.slice(0, visible);
  const exportUrl = `${root}blood-pressure/export/?${exportQuery}${source ? `&source=${encodeURIComponent(source)}` : ""}`;
  const header = (col: SortColumn | null, label: string, numeric = false) => (
    <div
      role="columnheader"
      className={numeric ? "qs-num" : undefined}
      aria-sort={
        col && sort.col === col ? (sort.dir === 1 ? "ascending" : "descending") : undefined
      }
    >
      {col ? (
        <button
          className="qs-sort"
          onClick={() =>
            setSort(
              sort.col === col
                ? { col, dir: sort.dir === 1 ? -1 : 1 }
                : { col, dir: col === "date" ? -1 : 1 }
            )
          }
        >
          {label}
          {sort.col === col && <span className="qs-sort-dir">{sort.dir === 1 ? "↑" : "↓"}</span>}
        </button>
      ) : (
        label
      )}
    </div>
  );
  return (
    <section className="qs-panel qs-readings" id="qs-readings">
      <div className="qs-readings-toolbar">
        <h2 className="qs-panel-title">Readings</h2>
        <div className="qs-readings-controls">
          {selectedDay && (
            <button
              className="qs-control qs-day-chip"
              onClick={onClearDay}
              aria-label={`Clear day filter ${selectedDay}`}
            >
              day: {short(selectedDay)} ×
            </button>
          )}
          <label className="qs-control qs-search">
            <FontAwesomeIcon icon={faSearch} />
            <input
              type="search"
              placeholder="search notes"
              aria-label="Search notes"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <label className="qs-control qs-source-filter">
            source:
            <select value={source} aria-label="Source" onChange={e => setSource(e.target.value)}>
              <option value="">all</option>
              {sources.map(s => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <button
            className={`qs-control${showExcluded ? " on" : ""}`}
            aria-pressed={showExcluded}
            onClick={() => setShowExcluded(!showExcluded)}
          >
            {showExcluded ? "●" : "○"} show excluded
          </button>
          <a className="qs-control qs-export" href={exportUrl}>
            export csv
          </a>
        </div>
      </div>
      <div role="table" aria-label="Blood pressure readings" className="qs-ledger">
        <div role="row" className="qs-ledger-row qs-ledger-head">
          {header("date", "date")}
          {header("time", "time")}
          {header("systolic", "systolic", true)}
          {header("diastolic", "diastolic", true)}
          {header("pulse", "pulse", true)}
          {header("source", "source")}
          {header(null, "note")}
          <div role="columnheader">
            <span className="qs-visually-hidden">actions</span>
          </div>
        </div>
        {shown.map(row => {
          const level = category(row.systolic ?? 0, row.diastolic ?? 0);
          const flagged = !row.excluded && level !== "normal";
          const tone = flagged ? categoryTone(level) : "";
          return (
            <div
              role="row"
              key={row.uuid}
              className={`qs-ledger-row${row.excluded ? " qs-ledger-excluded" : ""}${tone ? ` qs-ledger-${tone}` : ""}`}
            >
              <div role="cell" className="qs-strong">
                {row.date}
              </div>
              <div role="cell">{clock(row) || "—"}</div>
              <div role="cell" className="qs-num qs-strong qs-tinted">
                {row.systolic}
              </div>
              <div role="cell" className="qs-num qs-strong qs-tinted">
                {row.diastolic}
              </div>
              <div role="cell" className="qs-num">
                {row.pulse ?? "—"}
              </div>
              <div role="cell" className="qs-source">
                {row.source}
              </div>
              {confirming === row.uuid ? (
                <div role="cell" className="qs-ledger-confirm">
                  <span>delete this reading? · cannot be undone</span>
                  <button
                    className="qs-text-btn qs-danger-text"
                    onClick={() => {
                      setConfirming(null);
                      onDelete(row);
                    }}
                  >
                    delete
                  </button>
                  <button className="qs-text-btn" autoFocus onClick={() => setConfirming(null)}>
                    cancel
                  </button>
                </div>
              ) : (
                <>
                  <div role="cell" className="qs-ledger-note">
                    {row.excluded ? (
                      <>
                        <s>excluded{row.note ? ` · ${row.note}` : ""}</s>{" "}
                        <button className="qs-text-btn qs-restore" onClick={() => onRestore(row)}>
                          restore
                        </button>
                      </>
                    ) : (
                      <>
                        {row.note ? (
                          <span>{row.note}</span>
                        ) : (
                          <span className="qs-dim-note">—</span>
                        )}
                        {flagged && <span className={`qs-badge qs-badge-${tone}`}>{level}</span>}
                      </>
                    )}
                  </div>
                  <div role="cell" className="qs-ledger-actions">
                    {!row.excluded && (
                      <>
                        <button
                          aria-label={`Edit reading ${stamp(row)}`}
                          onClick={() => onEdit(row)}
                        >
                          <FontAwesomeIcon icon={faPencilAlt} />
                        </button>
                        <button
                          aria-label={`Delete reading ${stamp(row)}`}
                          onClick={() => setConfirming(row.uuid)}
                        >
                          <FontAwesomeIcon icon={faTrashAlt} />
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        {!filtered.length && (
          <div role="row" className="qs-ledger-row qs-ledger-empty">
            <div role="cell">No readings match your filter.</div>
          </div>
        )}
      </div>
      <div className="qs-ledger-foot">
        <span>
          showing {shown.length} of {filtered.length}
          {excludedCount > 0 && ` · ${excludedCount} excluded`}
        </span>
        {visible < filtered.length && (
          <button className="qs-text-btn" onClick={() => setVisible(visible + PAGE)}>
            load {Math.min(PAGE, filtered.length - visible)} more ↓
          </button>
        )}
      </div>
    </section>
  );
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
  const [rows, setRows] = useState<Reading[] | null>(null);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const query = new URLSearchParams({ start, end }).toString();
  useEffect(() => {
    let active = true;
    setError("");
    api<{ results: Reading[] }>(`${root}blood-pressure/records/?${query}&limit=20000`)
      .then(value => {
        if (active) setRows(value.results);
      })
      .catch(err => {
        if (active) setError(errorText(err));
      });
    return () => {
      active = false;
    };
  }, [root, query, revision]);
  useEffect(() => setSelectedDay(null), [query]);
  const readings = useMemo(
    () =>
      (rows ?? []).filter(
        (r): r is Pressure => !r.excluded && r.systolic != null && r.diastolic != null
      ),
    [rows]
  );
  const means = useMemo(() => dailyMeans(readings), [readings]);
  const preset = BP_RANGES.find(([days]) => start === daysBefore(end, days - 1))?.[0];
  // A ten-year "all" range would squeeze readings into one corner; start the chart at the first one.
  const first = readings.reduce<string | null>(
    (min, r) => (!min || r.date < min ? r.date : min),
    null
  );
  const dates = datesBetween(preset === 3660 && first ? first : start, end);
  const sources = [...new Set(readings.map(r => r.source))].sort();
  const excluded = (rows ?? []).filter(r => r.excluded).length;
  async function mutate(next: Reading[] | null, request: () => Promise<unknown>) {
    const previous = rows;
    setRows(next);
    setError("");
    try {
      await request();
      onChanged();
    } catch (err) {
      setRows(previous);
      setError(errorText(err));
    }
  }
  return (
    <>
      <div className="qs-statusline">
        <div>
          <span className="qs-dim">// </span>range{" "}
          <b>
            {start} → {end}
          </b>{" "}
          · {plural(datesBetween(start, end).length, "day")}
          {rows && (
            <>
              {" "}
              · <b>{plural(readings.length, "reading")}</b> on <b>{means.size}</b>{" "}
              {means.size === 1 ? "day" : "days"} · {excluded} excluded
              {sources.length > 0 && (
                <>
                  {" "}
                  · sources{" "}
                  {sources.map((s, i) => (
                    <React.Fragment key={s}>
                      {i > 0 && " · "}
                      <b className="qs-source">{s}</b>
                    </React.Fragment>
                  ))}
                </>
              )}
            </>
          )}
        </div>
        <div className="qs-ranges">
          {BP_RANGES.map(([days, label]) => (
            <button
              key={days}
              className={preset === days ? "active" : ""}
              aria-pressed={preset === days}
              onClick={() => onRange(daysBefore(today(), days - 1), today())}
            >
              {label}
            </button>
          ))}
          <button className="qs-cta" onClick={onAdd}>
            <FontAwesomeIcon icon={faPlus} />
            reading
          </button>
        </div>
      </div>
      {error && (
        <p className="qs-error" role="alert">
          {error}
        </p>
      )}
      {!rows && !error && (
        <p className="qs-muted" role="status">
          Loading readings…
        </p>
      )}
      <Kpis readings={readings} means={[...means.values()]} />
      <DailyChart
        dates={dates}
        means={means}
        selected={selectedDay}
        onSelect={day => {
          setSelectedDay(selectedDay === day ? null : day);
          document
            .getElementById("qs-readings")
            ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        }}
      />
      <ReadingsTable
        rows={rows ?? []}
        root={root}
        exportQuery={query}
        selectedDay={selectedDay}
        onClearDay={() => setSelectedDay(null)}
        onEdit={onEdit}
        onDelete={row =>
          mutate(
            (rows ?? []).filter(r => r.uuid !== row.uuid),
            () => api(`${root}blood-pressure/records/${row.uuid}/`, "DELETE")
          )
        }
        onRestore={row =>
          mutate(
            (rows ?? []).map(r => (r.uuid === row.uuid ? { ...r, excluded: false } : r)),
            () => api(`${root}blood-pressure/records/${row.uuid}/`, "PATCH", { excluded: false })
          )
        }
      />
    </>
  );
}
