import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencilAlt, faPlus } from "@fortawesome/free-solid-svg-icons";
import { api, daysBefore, errorText, today } from "./api";
import { line, scale, useWidth, dateTicks } from "./chart";
import { ChartTooltip, Kpi, StatusLine, Toggle, mean, nearest, plural, short } from "./Ledger";
import DayDetail from "./DayDetail";
import { Dashboard, Day, Reading, Status } from "./types";

const RANGES: [number, string][] = [
  [7, "7d"],
  [30, "30d"],
  [90, "90d"],
  [365, "1y"],
];
const PAGE = 20;
// The review endpoint accepts at most this many nights per request.
const REVIEW_BATCH = 366;
// API event hours are offsets from noon. Match ingest_awakening's [22:00, 09:00) window.
const TRACK_START = 10;
const TRACK_END = 21;
const TRACK_TICKS: [number, string][] = [
  [10, "10 pm"],
  [12, "midnight"],
  [15, "3 am"],
  [18, "6 am"],
  [21, "9 am"],
];
const trackX = (hour: number, width: number) =>
  ((hour - TRACK_START) / (TRACK_END - TRACK_START)) * width;
const count = (day: Day) => day.events.length;
const isEmptyUnreviewed = (day: Day) => day.status === "unreviewed" && !count(day);
const hhmm = (time: string) => time.slice(0, 5);
const STATUS_LABEL: Record<Status, string> = {
  unreviewed: "● unreviewed",
  complete: "✓ complete",
  incomplete: "½ incomplete",
};

function tally(days: Day[]) {
  return {
    complete: days.filter(d => d.status === "complete").length,
    incomplete: days.filter(d => d.status === "incomplete").length,
    unreviewed: days.filter(d => d.status === "unreviewed").length,
  };
}

/** Mean awakenings over complete nights only; unreviewed nights are missing, never zero. */
export function nightlyMean(days: Day[]) {
  const complete = days.filter(d => d.status === "complete");
  return complete.length ? mean(complete.map(count)) : null;
}

/** Longest run of consecutive complete nights with no awakenings. */
export function quietStreak(days: Day[]) {
  let best: { from: string; to: string; length: number } | null = null;
  let run: Day[] = [];
  for (const day of days) {
    if (day.status === "complete" && !count(day)) {
      run.push(day);
      if (!best || run.length > best.length)
        best = { from: run[0].date, to: day.date, length: run.length };
    } else run = [];
  }
  return best;
}

/** The busiest hour, plus the busiest three-hour window, from the noon-first histogram. */
export function peakHour(histogram: Dashboard["histogram"]) {
  const total = histogram.reduce((sum, bin) => sum + bin.count, 0);
  if (total < 5) return null;
  const peak = histogram.reduce((a, b) => (b.count > a.count ? b : a));
  let windowStart = 0;
  let windowCount = -1;
  for (let i = 0; i + 3 <= histogram.length; i++) {
    const sum = histogram[i].count + histogram[i + 1].count + histogram[i + 2].count;
    if (sum > windowCount) [windowStart, windowCount] = [i, sum];
  }
  const endHour = (Number(histogram[windowStart].hour.slice(0, 2)) + 3) % 24;
  return {
    hour: peak.hour,
    count: peak.count,
    total,
    share: Math.round((windowCount / total) * 100),
    from: histogram[windowStart].hour,
    to: `${String(endHour).padStart(2, "0")}:00`,
  };
}

function Progress({ complete, incomplete, total }: Record<string, number>) {
  const c = total ? (complete / total) * 100 : 0;
  const i = total ? (incomplete / total) * 100 : 0;
  return (
    <svg className="qs-progress" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true">
      <rect className="qs-progress-track" width="100" height="4" rx="2" />
      <rect className="qs-progress-complete" width={c} height="4" />
      <rect className="qs-progress-incomplete" x={c} width={i} height="4" />
    </svg>
  );
}

function Kpis({
  days,
  histogram,
  previous,
}: {
  days: Day[];
  histogram: Dashboard["histogram"];
  previous: Day[] | null;
}) {
  const last = days[days.length - 1];
  const counts = tally(days);
  const average = counts.complete >= 3 ? nightlyMean(days) : null;
  const before = previous && tally(previous).complete >= 3 ? nightlyMean(previous) : null;
  const change = average != null && before != null ? average - before : null;
  const peak = peakHour(histogram);
  const streak = quietStreak(days);
  const statusTone = (status: Status) => (status === "complete" ? "ok" : "warn");
  return (
    <div className="qs-kpis">
      <Kpi
        lead
        label="last night"
        value={last ? count(last) : "—"}
        unit="recorded"
        meta={
          last ? (
            <>
              night ending {short(last.date)}
              <br />
              <span className={`qs-${statusTone(last.status)}-text`}>● {last.status}</span>
              {last.events.length > 0 &&
                ` · first ${hhmm(last.events[0].time)} · last ${hhmm(last.events[last.events.length - 1].time)}`}
            </>
          ) : (
            "—"
          )
        }
      />
      <Kpi
        label="nightly mean"
        value={average != null ? average.toFixed(1) : "—"}
        unit="/ night"
        meta={
          <>
            {plural(counts.complete, "complete night")} only
            <br />
            {change != null ? (
              <span
                className={
                  Math.abs(change) < 0.05 ? "" : change < 0 ? "qs-ok-text" : "qs-danger-text"
                }
              >
                {Math.abs(change) < 0.05 ? "→" : change < 0 ? "↓" : "↑"}{" "}
                {Math.abs(change).toFixed(1)} vs previous {days.length}
              </span>
            ) : (
              "needs 3 complete nights per period"
            )}
          </>
        }
      />
      <Kpi
        label="review coverage"
        value={
          days.length ? (
            <>
              {counts.complete}
              <span className="qs-kpi-sep">/</span>
              {days.length}
            </>
          ) : (
            "—"
          )
        }
        meta={
          <>
            <Progress
              complete={counts.complete}
              incomplete={counts.incomplete}
              total={days.length}
            />
            {counts.unreviewed} unreviewed · {days.filter(isEmptyUnreviewed).length} have no events
          </>
        }
      />
      <Kpi
        label="peak hour"
        value={
          peak ? (
            <>
              {peak.hour.slice(0, 2)}
              <span className="qs-kpi-sep">:</span>
              {peak.hour.slice(3)}
            </>
          ) : (
            "—"
          )
        }
        meta={
          peak ? (
            <>
              {peak.count} of {plural(peak.total, "event")}
              <br />
              {peak.share}% between {peak.from}–{peak.to}
            </>
          ) : (
            "needs 5 events"
          )
        }
      />
      <Kpi
        label="longest quiet streak"
        value={streak ? streak.length : "—"}
        unit={streak?.length === 1 ? "night" : "nights"}
        meta={
          streak ? (
            <>
              {short(streak.from)} → {short(streak.to)} · zero awakenings
              <br />
              complete nights only
            </>
          ) : (
            "no confirmed zero nights"
          )
        }
      />
    </div>
  );
}

function explain(day: Day) {
  const n = count(day);
  if (day.status === "complete")
    return n ? `${plural(n, "awakening")} · in mean` : "confirmed zero";
  if (day.status === "incomplete") return "partial night · excluded from mean";
  return n ? "not in the mean until confirmed" : "missing · not zero until confirmed";
}

/** 7-night rolling mean over complete nights; null where fewer than 3 are complete. */
function rollingMean(days: Day[]) {
  return days.map((_, i) => {
    const window = days.slice(Math.max(0, i - 6), i + 1).filter(d => d.status === "complete");
    return window.length >= 3 ? mean(window.map(count)) : null;
  });
}

export function PerNightChart({
  days,
  loading,
  onSelect,
}: {
  days: Day[];
  loading: boolean;
  onSelect: (date: string) => void;
}) {
  const [ref, width] = useWidth(1060);
  const [toggles, setToggles] = useState({ mean: true, heat: false });
  const [hover, setHover] = useState<string | null>(null);
  const height = 200;
  const [top, bottom, left, right] = [12, 172, 30, 8];
  const slot = (width - left - right) / Math.max(days.length, 1);
  const x = (i: number) => left + slot * (i + 0.5);
  const bar = Math.max(2, Math.min(18, slot * 0.7));
  const max = Math.max(6, ...days.map(count));
  const ymax = Math.ceil(max / 2) * 2;
  const y = scale([0, ymax], [bottom, top]);
  const step = ymax <= 12 ? 2 : Math.ceil(ymax / 6);
  const ticks: number[] = [];
  for (let t = 0; t <= ymax; t += step) ticks.push(t);
  const latestUnreviewed = [...days].reverse().find(d => d.status === "unreviewed" && count(d));
  const rolling = rollingMean(days);
  const segments: { x: number; y: number }[][] = [];
  rolling.forEach((value, i) => {
    if (value == null) return;
    const point = { x: x(i), y: y(value) };
    if (i > 0 && rolling[i - 1] != null) segments[segments.length - 1].push(point);
    else segments.push([point]);
  });
  // Heat mode: one cell per night per hour, noon at the top.
  const cell = (bottom - top) / 24;
  const heat = days.map(d => {
    const hours = new Array(24).fill(0);
    for (const e of d.events) hours[Math.min(23, Math.floor(e.hour))] += 1;
    return hours;
  });
  const heatMax = Math.max(1, ...heat.flat());
  const hovered = hover ? days.findIndex(d => d.date === hover) : -1;
  const toggle = (key: keyof typeof toggles, label: string) => (
    <Toggle
      on={toggles[key]}
      label={label}
      onClick={() => setToggles({ ...toggles, [key]: !toggles[key] })}
    />
  );
  const indexed = days.map((day, i) => ({ day, i }));
  const locate = (event: React.MouseEvent<SVGRectElement>) =>
    nearest(event, width, indexed, d => x(d.i))?.day ?? null;
  return (
    <section
      className="qs-panel qs-bp-chart"
      title="Counts include recorded events on unreviewed nights. Only complete nights contribute to the average."
    >
      <div className="qs-panel-head qs-ruled">
        <h2 className="qs-panel-title">Per night</h2>
        <div className="qs-toggles">
          {toggle("mean", "7-night mean")}
          {toggle("heat", "time-of-night heat")}
        </div>
      </div>
      <div ref={ref}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          height={height}
          role="img"
          aria-label={
            toggles.heat
              ? "Awakenings per night by hour, noon to noon"
              : "Awakenings per night, encoded by review status"
          }
        >
          <g className="qs-grid">
            {(toggles.heat ? [0, 6, 12, 18, 24] : ticks).map(t => {
              const ty = toggles.heat ? top + t * cell : y(t);
              return <line key={t} x1={left} y1={ty} x2={width - right} y2={ty} />;
            })}
          </g>
          {!toggles.heat && (
            <line className="qs-baseline" x1={left} y1={bottom} x2={width - right} y2={bottom} />
          )}
          <g className="qs-axis-text">
            {toggles.heat
              ? ["noon", "6p", "mid", "6a", "noon"].map((label, n) => (
                  <text key={n} x="0" y={top + n * 6 * cell + 4}>
                    {label}
                  </text>
                ))
              : ticks.map(t => (
                  <text key={t} x="0" y={y(t) + 4}>
                    {t}
                  </text>
                ))}
            {dateTicks(days).map((i, n, list) => (
              <text
                key={i}
                x={x(i)}
                y={height - 6}
                textAnchor={n === 0 ? "start" : n === list.length - 1 ? "end" : "middle"}
              >
                {short(days[i].date)}
              </text>
            ))}
            {!days.length && !loading && (
              <text
                className="qs-chart-empty"
                x={(left + width) / 2}
                y={(top + bottom) / 2}
                textAnchor="middle"
              >
                no nights in this range
              </text>
            )}
          </g>
          {toggles.heat ? (
            <g className="qs-heat">
              {heat.flatMap((hours, i) =>
                hours.map((n, h) =>
                  n ? (
                    <rect
                      key={`${i}-${h}`}
                      x={x(i) - bar / 2}
                      y={top + h * cell}
                      width={bar}
                      height={Math.max(1, cell - 1)}
                      fillOpacity={0.15 + 0.85 * (n / heatMax)}
                    />
                  ) : null
                )
              )}
            </g>
          ) : (
            <g className="qs-night-bars">
              {days.map((day, i) => {
                const n = count(day);
                const bx = x(i) - bar / 2;
                if (day.status === "complete" && !n)
                  return (
                    <rect
                      key={day.date}
                      className="qs-nb-zero"
                      x={bx}
                      y={bottom - 3}
                      width={bar}
                      height="3"
                    />
                  );
                if (day.status === "unreviewed" && !n)
                  return (
                    <rect
                      key={day.date}
                      className="qs-nb-missing"
                      x={bx}
                      y={bottom - 2}
                      width={bar}
                      height="2"
                    />
                  );
                return (
                  <g key={day.date}>
                    {n > 0 && (
                      <rect
                        className={`qs-nb-count qs-nb-${day.status}${day === latestUnreviewed ? " qs-nb-latest" : ""}`}
                        x={bx}
                        y={y(n)}
                        width={bar}
                        height={bottom - y(n)}
                        rx={Math.min(3, bar / 2)}
                      />
                    )}
                    {day.status === "incomplete" && (
                      <rect
                        className="qs-nb-partial"
                        x={bx}
                        y={bottom - 7}
                        width={bar}
                        height="7"
                      />
                    )}
                  </g>
                );
              })}
            </g>
          )}
          {toggles.mean && !toggles.heat && (
            <g className="qs-rolling-mean">
              {segments.map((points, n) =>
                points.length > 1 ? <path key={n} d={line(points)} /> : null
              )}
            </g>
          )}
          {hovered >= 0 && !toggles.heat && (
            <rect
              className="qs-crosshair"
              x={x(hovered) - slot / 2}
              y={top}
              width={slot}
              height={bottom - top}
            />
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
          {hovered >= 0 && (
            <ChartTooltip
              x={x(hovered)}
              y={toggles.heat ? top + 40 : y(count(days[hovered]))}
              head={`${short(days[hovered].date)} · ${days[hovered].status} · ${count(days[hovered])} recorded`}
              body={explain(days[hovered])}
              width={width}
              left={left}
              right={right}
              top={top}
            />
          )}
        </svg>
      </div>
      {toggles.heat ? (
        <div className="qs-night-legend">
          <span>
            <i className="qs-swatch-complete" />
            darker = more awakenings in that hour · all nights, reviewed or not
          </span>
        </div>
      ) : (
        <div className="qs-night-legend">
          <span>
            <i className="qs-swatch-complete" />
            complete
          </span>
          <span>
            <i className="qs-swatch-unreviewed" />
            unreviewed with events · not in mean
          </span>
          <span>
            <i className="qs-swatch-zero" />
            complete · zero
          </span>
          <span>
            <i className="qs-swatch-incomplete" />
            incomplete
          </span>
          <span>
            <i className="qs-swatch-missing" />
            unreviewed · missing, not zero
          </span>
          <span>
            <i className="qs-swatch-mean" />
            7-night mean
          </span>
        </div>
      )}
    </section>
  );
}

function Track({ day, width }: { day: Day; width: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const h = 48;
  const mid = h / 2;
  const events = day.events.filter(e => e.hour >= TRACK_START && e.hour < TRACK_END);
  const event = events.find(e => e.uuid === hover);
  const ex = event ? trackX(event.hour, width) : 0;
  const label = event
    ? `${event.time.slice(0, 8)} ${event.time.slice(9, 12)} · ${event.source.toLowerCase()}`
    : "";
  const labelWidth = label.length * 6.1 + 16;
  const flip = ex + 12 + labelWidth > width;
  return (
    <svg className="qs-track" viewBox={`0 0 ${width} ${h}`} height={h} aria-hidden={!events.length}>
      {TRACK_TICKS.slice(1, -1).map(([hour]) => (
        <line
          key={hour}
          className={hour === 12 ? "qs-track-midnight" : "qs-track-quarter"}
          x1={trackX(hour, width)}
          x2={trackX(hour, width)}
          y1="0"
          y2={h}
        />
      ))}
      <line
        className={`qs-track-base${day.status === "complete" && !count(day) ? " qs-track-zero" : ""}${day.status === "incomplete" ? " qs-track-partial" : ""}`}
        x1="0"
        x2={width}
        y1={mid}
        y2={mid}
      />
      {events.map(e => (
        <circle
          key={e.uuid}
          className="qs-track-dot"
          cx={trackX(e.hour, width)}
          cy={mid}
          r="5"
          tabIndex={0}
          role="img"
          aria-label={`Awakening ${e.time} · ${e.source}`}
          onMouseEnter={() => setHover(e.uuid)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(e.uuid)}
          onBlur={() => setHover(null)}
        />
      ))}
      {event && (
        <g
          className="qs-tooltip qs-tooltip-accent"
          transform={`translate(${flip ? ex - 12 - labelWidth : ex + 12},${mid - 12})`}
          pointerEvents="none"
        >
          <rect width={labelWidth} height="24" rx="6" />
          <text className="qs-tooltip-body" x="8" y="16">
            {label}
          </text>
        </g>
      )}
    </svg>
  );
}

function Timeline({
  days,
  loading,
  root,
  exportQuery,
  pending,
  highlight,
  error,
  onReview,
  onAdd,
  onOpen,
}: {
  days: Day[];
  loading: boolean;
  root: string;
  exportQuery: string;
  pending: Set<string>;
  highlight: string | null;
  error: string;
  onReview: (nights: Day[], status: Status) => Promise<boolean>;
  onAdd: (date: string) => void;
  onOpen: (date: string) => void;
}) {
  const [trackRef, trackWidth] = useWidth(600);
  const [status, setStatus] = useState<"all" | Status>("all");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);
  const rows = useMemo(
    () =>
      [...days]
        .reverse()
        .filter(
          d => (status === "all" || d.status === status) && !(hideEmpty && isEmptyUnreviewed(d))
        ),
    [days, status, hideEmpty]
  );
  const shown = rows.slice(0, visible);
  const counts = tally(days);
  const emptyUnreviewed = days.filter(d => isEmptyUnreviewed(d) && d.date <= today());
  useEffect(() => setVisible(PAGE), [status, hideEmpty, exportQuery]);
  useEffect(() => setSelected(new Set()), [exportQuery]);
  // A chart click can target a night beyond the current page.
  useEffect(() => {
    if (!highlight) return;
    const index = rows.findIndex(d => d.date === highlight);
    if (index >= visible) setVisible(Math.ceil((index + 1) / PAGE) * PAGE);
  }, [highlight, rows, visible]);
  useEffect(() => {
    const clear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) setSelected(new Set());
    };
    document.addEventListener("keydown", clear);
    return () => document.removeEventListener("keydown", clear);
  }, []);
  function toggleRow(date: string, range: boolean) {
    const next = new Set(selected);
    if (range && anchor) {
      const [a, b] = [rows.findIndex(d => d.date === anchor), rows.findIndex(d => d.date === date)];
      for (const d of rows.slice(Math.min(a, b), Math.max(a, b) + 1))
        if (d.date <= today()) next.add(d.date);
    } else if (next.has(date)) next.delete(date);
    else next.add(date);
    setSelected(next);
    setAnchor(date);
  }
  async function bulk(next: Status) {
    const nights = days.filter(d => selected.has(d.date));
    if (await onReview(nights, next)) setSelected(new Set());
  }
  const recorded = (day: Day) => {
    const n = count(day);
    if (day.status === "incomplete")
      return (
        <>
          {n}
          <span className="qs-dim">+</span>
        </>
      );
    if (day.status === "complete") return n ? n : <span className="qs-ok-text">0</span>;
    return n ? n : <span className="qs-dim">—</span>;
  };
  return (
    <section className="qs-panel qs-readings" id="qs-readings">
      <div className="qs-readings-toolbar">
        <div className="qs-timeline-title">
          <h2 className="qs-panel-title">Nightly timeline</h2>
          <span className="qs-timeline-sub">
            night ending on the date shown · New York time · 10 pm → 9 am
          </span>
        </div>
        <div className="qs-readings-controls">
          <label className="qs-control qs-source-filter">
            status:
            <select
              value={status}
              aria-label="Status"
              onChange={e => setStatus(e.target.value as "all" | Status)}
            >
              <option value="all">all</option>
              <option value="unreviewed">unreviewed</option>
              <option value="complete">complete</option>
              <option value="incomplete">incomplete</option>
            </select>
          </label>
          <button
            className={`qs-control${hideEmpty ? " on" : ""}`}
            aria-pressed={hideEmpty}
            onClick={() => setHideEmpty(!hideEmpty)}
          >
            {hideEmpty ? "●" : "○"} hide empty nights
          </button>
          <a className="qs-control qs-export" href={`${root}awakenings/export/?${exportQuery}`}>
            export csv
          </a>
        </div>
      </div>
      {error && (
        <p className="qs-error qs-timeline-error" role="alert">
          {error}
        </p>
      )}
      {selected.size > 0 && (
        <div className="qs-bulk" role="region" aria-label="Bulk review">
          <span className="qs-strong">{selected.size} selected</span>
          <button className="qs-control qs-bulk-confirm" onClick={() => bulk("complete")}>
            ✓ confirm complete
          </button>
          <button className="qs-control" onClick={() => bulk("incomplete")}>
            mark incomplete
          </button>
          <button className="qs-control" onClick={() => bulk("unreviewed")}>
            reset review
          </button>
          {emptyUnreviewed.length > 0 && (
            <button
              className="qs-text-btn qs-bulk-all"
              onClick={() => setSelected(new Set(emptyUnreviewed.map(d => d.date)))}
            >
              · select all {emptyUnreviewed.length} empty unreviewed
            </button>
          )}
          <span className="qs-bulk-hint">
            confirming a night with no events records zero awakenings
          </span>
        </div>
      )}
      <div role="table" aria-label="Nightly timeline" aria-busy={loading} className="qs-nights">
        <div role="row" className="qs-night-row qs-ledger-head">
          <div role="columnheader">
            <span className="qs-visually-hidden">select</span>
          </div>
          <div role="columnheader">night ending</div>
          <div role="columnheader" className="qs-track-labels" ref={trackRef}>
            <svg viewBox={`0 0 ${trackWidth} 16`} height="16">
              {TRACK_TICKS.map(([hour, label], i) => (
                <text
                  key={hour}
                  className={hour === 12 ? "qs-track-label-midnight" : undefined}
                  x={trackX(hour, trackWidth)}
                  y="12"
                  textAnchor={i === 0 ? "start" : i === TRACK_TICKS.length - 1 ? "end" : "middle"}
                >
                  {label}
                </text>
              ))}
            </svg>
          </div>
          <div role="columnheader" className="qs-num">
            recorded
          </div>
          <div role="columnheader">review</div>
          <div role="columnheader">
            <span className="qs-visually-hidden">actions</span>
          </div>
        </div>
        {shown.map(day => {
          const busy = pending.has(day.date);
          const future = day.date > today();
          return (
            <div
              role="row"
              key={day.date}
              id={`qs-night-${day.date}`}
              aria-selected={selected.has(day.date)}
              className={`qs-night-row qs-night-${day.status}${selected.has(day.date) ? " qs-night-selected" : ""}${highlight === day.date ? " qs-night-highlight" : ""}`}
              onClick={e => {
                if ((e.target as HTMLElement).closest("button, a, input, select, label")) return;
                if (!future) toggleRow(day.date, e.shiftKey);
              }}
            >
              <div role="cell">
                <input
                  type="checkbox"
                  className="qs-night-check"
                  aria-label={`Select ${day.date}`}
                  disabled={future}
                  checked={selected.has(day.date)}
                  // onClick rather than onChange, so shift-click can select a range.
                  onClick={e => toggleRow(day.date, e.shiftKey)}
                  onChange={() => undefined}
                />
              </div>
              <div role="cell" className="qs-strong">
                {day.date}
              </div>
              <div role="cell" className="qs-track-cell">
                <Track day={day} width={trackWidth} />
              </div>
              <div role="cell" className="qs-num">
                {recorded(day)}
              </div>
              <div role="cell" className="qs-night-review">
                <span className={`qs-review-chip qs-review-${day.status}`}>
                  {STATUS_LABEL[day.status]}
                </span>
                {day.status === "unreviewed" ? (
                  <>
                    <button
                      className="qs-review-btn qs-ok-text"
                      title="confirm complete"
                      aria-label={`Confirm ${day.date} complete`}
                      disabled={busy || future}
                      onClick={() => onReview([day], "complete")}
                    >
                      ✓
                    </button>
                    <button
                      className="qs-review-btn"
                      title="mark incomplete"
                      aria-label={`Mark ${day.date} incomplete`}
                      disabled={busy || future}
                      onClick={() => onReview([day], "incomplete")}
                    >
                      ½
                    </button>
                  </>
                ) : (
                  <button
                    className="qs-review-btn qs-review-reset"
                    aria-label={`Reset review of ${day.date}`}
                    disabled={busy}
                    onClick={() => onReview([day], "unreviewed")}
                  >
                    reset
                  </button>
                )}
              </div>
              <div role="cell" className="qs-ledger-actions">
                <button
                  aria-label={`Add an awakening to the night ending ${day.date}`}
                  onClick={() => onAdd(day.date)}
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
                {count(day) > 0 && (
                  <button
                    aria-label={`Edit awakenings for the night ending ${day.date}`}
                    onClick={() => onOpen(day.date)}
                  >
                    <FontAwesomeIcon icon={faPencilAlt} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!rows.length && !loading && (
          <div role="row" className="qs-night-row qs-ledger-empty">
            <div role="cell">No nights match your filter.</div>
          </div>
        )}
      </div>
      <div className="qs-ledger-foot">
        <span>
          {loading ? (
            "…"
          ) : (
            <>
              showing {shown.length} of {plural(rows.length, "night")} ·{" "}
              <span className="qs-ok-text">{counts.complete} complete</span> ·{" "}
              <span className="qs-warn-text">{counts.incomplete} incomplete</span> ·{" "}
              {counts.unreviewed} unreviewed
            </>
          )}
        </span>
        <span className="qs-foot-right">
          <Progress complete={counts.complete} incomplete={counts.incomplete} total={days.length} />
          {visible < rows.length && (
            <button className="qs-text-btn" onClick={() => setVisible(visible + PAGE)}>
              load {Math.min(PAGE, rows.length - visible)} more ↓
            </button>
          )}
        </span>
      </div>
    </section>
  );
}

function nowInNewYork() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

export default function Awakenings({
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
  onAdd: (defaults: { date?: string; time?: string }) => void;
  onEdit: (row: Reading) => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [previous, setPrevious] = useState<Day[] | null>(null);
  const [error, setError] = useState("");
  // Optimistic review statuses, shown until the refetched summary arrives.
  const [pending, setPending] = useState<Map<string, Status>>(new Map());
  const [highlight, setHighlight] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const query = new URLSearchParams({ start, end }).toString();
  const length = Math.round(
    (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000 + 1
  );
  useEffect(() => {
    let active = true;
    api<Dashboard>(`${root}summary/?${query}&unit=lb`)
      .then(value => {
        if (!active) return;
        setData(value);
        setPending(new Map());
      })
      .catch(err => {
        if (active) setError(errorText(err));
      });
    // The previous period of the same length, for the "vs previous" comparison.
    const before = new URLSearchParams({
      start: daysBefore(start, length),
      end: daysBefore(start, 1),
    }).toString();
    api<Dashboard>(`${root}summary/?${before}&unit=lb`)
      .then(value => {
        if (active) setPrevious(value.days);
      })
      .catch(() => {
        if (active) setPrevious(null);
      });
    return () => {
      active = false;
    };
  }, [root, query, start, length, revision]);
  useEffect(() => {
    if (!highlight) return;
    document
      .getElementById(`qs-night-${highlight}`)
      ?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    const timer = window.setTimeout(() => setHighlight(null), 1200);
    return () => window.clearTimeout(timer);
  }, [highlight]);
  const days = useMemo(
    () =>
      (data?.days ?? []).map(d =>
        pending.has(d.date) ? { ...d, status: pending.get(d.date)! } : d
      ),
    [data, pending]
  );
  async function review(nights: Day[], status: Status) {
    const targets = (data?.days ?? []).filter(d => nights.some(n => n.date === d.date));
    if (!targets.length) return false;
    setError("");
    setPending(current => new Map([...current, ...targets.map(d => [d.date, status] as const)]));
    try {
      for (let i = 0; i < targets.length; i += REVIEW_BATCH) {
        await api(`${root}nights/review/`, "POST", {
          nights: targets
            .slice(i, i + REVIEW_BATCH)
            .map(d => ({ date: d.date, revision: d.revision, status })),
        });
      }
      return true;
    } catch (err) {
      setError(errorText(err));
      setPending(current => {
        const next = new Map(current);
        for (const d of targets) next.delete(d.date);
        return next;
      });
      return false;
    } finally {
      // Refetch for fresh revisions, or to reload rows after a conflict.
      onChanged();
    }
  }
  const counts = tally(days);
  const events = days.reduce((sum, d) => sum + count(d), 0);
  const openDay = open ? days.find(d => d.date === open) : undefined;
  return (
    <>
      <StatusLine
        start={start}
        end={end}
        loaded={data !== null}
        ranges={RANGES}
        summary={
          <div className="qs-statusline-nowrap">
            <span className="qs-dim">// </span>
            <b title="New York time">
              {start} → {end}
            </b>{" "}
            · {plural(length, "night")}
            {data && (
              <>
                {" "}
                · <span className="qs-ok-text">{counts.complete} complete</span> ·{" "}
                <span className="qs-warn-text">{counts.incomplete} incomplete</span> ·{" "}
                <span className="qs-warn-text">{counts.unreviewed} unreviewed</span> ·{" "}
                {plural(events, "event")}
              </>
            )}
          </div>
        }
        addLabel={
          <>
            awakening <span className="qs-cta-suffix">now</span>
          </>
        }
        onRange={onRange}
        onAdd={() => onAdd({ date: today(), time: nowInNewYork() })}
      />
      <Kpis days={days} histogram={data?.histogram ?? []} previous={previous} />
      <PerNightChart days={days} loading={data === null} onSelect={date => setHighlight(date)} />
      <Timeline
        days={days}
        loading={data === null}
        root={root}
        exportQuery={query}
        pending={new Set(pending.keys())}
        highlight={highlight}
        error={error}
        onReview={review}
        onAdd={date => onAdd({ date })}
        onOpen={setOpen}
      />
      {openDay && (
        <DayDetail
          key={openDay.date}
          day={openDay}
          kind="awakenings"
          unit="lb"
          root={root}
          revision={revision}
          onClose={() => setOpen(null)}
          onSaved={onChanged}
          onEdit={onEdit}
        />
      )}
    </>
  );
}
