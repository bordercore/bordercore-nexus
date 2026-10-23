import React, { useId, useLayoutEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faPlus } from "@fortawesome/free-solid-svg-icons";
import { api, errorText, today } from "./api";
import { Dashboard, Day, Kind, Status } from "./types";

type Point = { x: number; y: number; day: Day };
const KG_PER_LB = 0.45359237;

// Tracks the rendered width of a chart container so SVG viewBoxes match real
// pixels and axis text stays at its intended size instead of scaling.
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measured = Math.round(node.getBoundingClientRect().width);
    if (measured) setWidth(measured);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
function extent(values: (number | null)[], pad: number): [number, number] | null {
  const present = values.filter((v): v is number => v !== null);
  if (!present.length) return null;
  return [Math.min(...present) - pad, Math.max(...present) + pad];
}
function scale([d0, d1]: [number, number], [r0, r1]: [number, number]) {
  return (value: number) => r0 + ((value - d0) / (d1 - d0 || 1)) * (r1 - r0);
}
function line(points: { x: number; y: number }[]) {
  return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}
function dateTicks(days: Day[]) {
  if (!days.length) return [];
  const last = days.length - 1;
  return [...new Set([0, 1, 2, 3, 4].map(k => Math.round((k * last) / 4)))].filter(i => i >= 0);
}
const short = (date: string) => date.slice(5);
const round = (value: number | null | undefined) => (value == null ? "—" : Math.round(value));
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

function Gauge({
  tone,
  count,
  total,
  totalLabel,
  label,
  value,
  unit,
  onClick,
  children,
}: {
  tone: Kind;
  count: number | null;
  total: number | null;
  totalLabel: string;
  label: string;
  value: string;
  unit: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const fraction = count && total ? Math.min(count / total, 1) : 0;
  return (
    <button className={`qs-gauge qs-tone-${tone}`} onClick={onClick}>
      <svg viewBox="0 0 92 92" className="qs-gauge-ring" aria-hidden="true">
        <circle className="qs-ring-track" cx="46" cy="46" r="38" />
        {fraction > 0 && (
          <circle
            className="qs-ring-arc"
            cx="46"
            cy="46"
            r="38"
            strokeDasharray={`${(fraction * 239).toFixed(1)} 239`}
            transform="rotate(-90 46 46)"
          />
        )}
        <text className="qs-ring-count" x="46" y="43" textAnchor="middle">
          {count ?? "…"}
        </text>
        <text className="qs-ring-total" x="46" y="58" textAnchor="middle">
          / {total ?? "…"} {totalLabel}
        </text>
      </svg>
      <span className="qs-gauge-text">
        <span className="qs-gauge-label">{label}</span>
        <span className="qs-gauge-value">
          {value}
          <span className="qs-gauge-unit">{unit}</span>
        </span>
        <span className="qs-gauge-meta">{children}</span>
      </span>
    </button>
  );
}

function Gauges({
  data,
  unit,
  onExplore,
}: {
  data: Dashboard | null;
  unit: string;
  onExplore: (kind: Kind) => void;
}) {
  const summary = data?.summary;
  const days = data?.days.length ?? null;
  const loading = data === null;
  const lastNight = data?.days.find(d => d.date === today());
  const weight = summary?.latest_weight;
  const pressure = summary?.latest_pressure;
  const change = summary?.weight_change ?? null;
  const trend = data ? [...data.days].reverse().find(d => d.weight_trend !== null) : undefined;
  const blank = loading ? "…" : "—";
  return (
    <>
      <Gauge
        tone="awakenings"
        count={summary?.completed_nights ?? null}
        total={summary?.total_nights ?? null}
        totalLabel="nights"
        label="awakenings"
        value={summary?.mean_awakenings != null ? String(summary.mean_awakenings) : blank}
        unit="/ night"
        onClick={() => onExplore("awakenings")}
      >
        complete nights only
        <br />
        last night{" "}
        {lastNight ? (
          <span className={`qs-status-text ${lastNight.status}`}>● {lastNight.status}</span>
        ) : (
          <span className="qs-dim">{loading ? "…" : "outside range"}</span>
        )}
      </Gauge>
      <Gauge
        tone="weight"
        count={summary?.weight_days ?? null}
        total={days}
        totalLabel="days"
        label="weight"
        value={
          weight ? ((weight.kilograms || 0) / (unit === "lb" ? KG_PER_LB : 1)).toFixed(1) : blank
        }
        unit={unit}
        onClick={() => onExplore("weight")}
      >
        {change !== null ? (
          <>
            <span className={change > 0 ? "qs-up" : "qs-down"}>
              {change > 0 ? "↑" : "↓"} {Math.abs(change).toFixed(1)}
            </span>{" "}
            since previous
          </>
        ) : (
          "no previous reading"
        )}
        <br />
        trend {trend?.weight_trend != null ? trend.weight_trend.toFixed(1) : "—"}
        {weight ? ` · ${weight.date}` : ""}
      </Gauge>
      <Gauge
        tone="blood-pressure"
        count={summary?.pressure_days ?? null}
        total={days}
        totalLabel="days"
        label="blood pressure"
        value={pressure ? `${pressure.systolic}/${pressure.diastolic}` : blank}
        unit="mmHg"
        onClick={() => onExplore("blood-pressure")}
      >
        mean {round(summary?.mean_systolic)}/{round(summary?.mean_diastolic)} ·{" "}
        {summary ? plural(summary.pressure_readings, "reading") : "… readings"}
        <br />
        {pressure
          ? `${pressure.pulse ? `pulse ${pressure.pulse} · ` : ""}${pressure.date}`
          : "no readings yet"}
      </Gauge>
    </>
  );
}

const LANES: { kind: Kind; top: number; bottom: number }[] = [
  { kind: "awakenings", top: 0, bottom: 100 },
  { kind: "weight", top: 100, bottom: 200 },
  { kind: "blood-pressure", top: 200, bottom: 310 },
];
const GUTTER = 60;
const HEIGHT = 330;

function PressurePair({
  systolic,
  diastolic,
  width,
  label,
}: {
  systolic: Point;
  diastolic: Point;
  width: number;
  label: boolean;
}) {
  const labelOnLeft = systolic.x + 145 > width;
  return (
    <>
      <line
        className="qs-pressure-pair"
        x1={systolic.x}
        x2={diastolic.x}
        y1={systolic.y}
        y2={diastolic.y}
      />
      <circle cx={systolic.x} cy={systolic.y} r="4.5" />
      <circle className="qs-faint" cx={diastolic.x} cy={diastolic.y} r="4.5" />
      {label && (
        <text
          className="qs-pressure-label"
          x={systolic.x + (labelOnLeft ? -12 : 12)}
          y={(systolic.y + diastolic.y) / 2 + 4}
          textAnchor={labelOnLeft ? "end" : "start"}
        >
          {round(systolic.day.systolic)}/{round(systolic.day.diastolic)} ·{" "}
          {short(systolic.day.date)}
        </text>
      )}
    </>
  );
}

function Timeline({ data, onDay }: { data: Dashboard; onDay: (kind: Kind, day: Day) => void }) {
  const [ref, width] = useWidth(780);
  const [selection, setSelection] = useState<{ days: Day[]; index: number } | null>(null);
  const gradient = useId();
  const days = data.days;
  const hover = selection?.days === days ? selection.index : null;
  const setHover = (index: number | null) => setSelection(index === null ? null : { days, index });
  const slot = (width - GUTTER) / Math.max(days.length, 1);
  const x = (i: number) => GUTTER + slot * (i + 0.5);
  const barWidth = Math.max(Math.min(12, slot * 0.6), 1);

  const maxWake = Math.max(1, ...days.map(d => d.awakenings ?? 0));
  const wakeY = scale([0, maxWake], [90, 24]);
  const hasWake = days.some(d => d.status !== "unreviewed" || d.events.length);
  const peakWake = days.reduce(
    (best, d, i) =>
      d.status === "complete" && (d.awakenings ?? 0) > (days[best]?.awakenings ?? 0) ? i : best,
    -1
  );

  const weightDomain = extent(
    days.flatMap(d => [d.weight, d.weight_trend]),
    0.5
  );
  const weightY = weightDomain ? scale(weightDomain, [190, 128]) : null;
  const weights: Point[] = [];
  const trend: Point[] = [];
  days.forEach((day, i) => {
    if (!weightY) return;
    if (day.weight !== null) weights.push({ x: x(i), y: weightY(day.weight), day });
    if (day.weight_trend !== null) trend.push({ x: x(i), y: weightY(day.weight_trend), day });
  });

  const pressureDomain = extent(
    days.flatMap(d => [d.systolic, d.diastolic]),
    5
  );
  const pressureY = pressureDomain ? scale(pressureDomain, [298, 228]) : null;
  const systolic: Point[] = [];
  const diastolic: Point[] = [];
  days.forEach((day, i) => {
    if (!pressureY || day.systolic === null || day.diastolic === null) return;
    systolic.push({ x: x(i), y: pressureY(day.systolic), day });
    diastolic.push({ x: x(i), y: pressureY(day.diastolic), day });
  });

  function locate(event: React.MouseEvent<SVGRectElement>) {
    const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * width;
    const py = ((event.clientY - box.top) / box.height) * HEIGHT;
    const index = Math.floor((px - GUTTER) / slot);
    const lane = LANES.find(l => py < l.bottom) ?? LANES[2];
    return { index: Math.max(0, Math.min(days.length - 1, index)), kind: lane.kind };
  }
  function keyDown(event: React.KeyboardEvent<SVGSVGElement>) {
    const current = hover ?? days.length - 1;
    if (event.key === "ArrowLeft") setHover(Math.max(0, current - 1));
    else if (event.key === "ArrowRight") setHover(Math.min(days.length - 1, current + 1));
    else if (event.key === "Enter" && hover !== null) onDay("awakenings", days[hover]);
    else return;
    event.preventDefault();
  }
  const fmt = (domain: [number, number], value: number) =>
    value.toFixed(domain[1] - domain[0] < 4 ? 1 : 0);
  const hovered = hover !== null ? days[hover] : null;
  const tipX = hover === null ? 0 : x(hover) + 166 > width ? x(hover) - 166 : x(hover) + 16;

  return (
    <div ref={ref} className="qs-timeline-chart">
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        height={HEIGHT}
        role="img"
        tabIndex={0}
        aria-label="Timeline of awakenings, weight and blood pressure on a shared date axis. Use the arrow keys to read a day and Enter to open it."
        onKeyDown={keyDown}
        onBlur={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="qs-stop-weight" stopOpacity="0.3" />
            <stop offset="1" className="qs-stop-weight" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="qs-grid">
          <line x1={GUTTER} y1="0" x2={GUTTER} y2="310" />
          {LANES.map(lane => (
            <line key={lane.kind} x1={GUTTER} y1={lane.bottom} x2={width} y2={lane.bottom} />
          ))}
        </g>
        <g className="qs-lane-label">
          <text x="0" y="14">
            WAKE
          </text>
          <text x="0" y="114">
            {data.unit.toUpperCase()}
          </text>
          <text x="0" y="214">
            MMHG
          </text>
        </g>
        <g className="qs-axis-text">
          {hasWake && (
            <>
              <text x="0" y="40">
                {maxWake}
              </text>
              <text x="0" y="90">
                0
              </text>
            </>
          )}
          {weightDomain && (
            <>
              <text x="0" y="132">
                {fmt(weightDomain, weightDomain[1] - 0.5)}
              </text>
              <text x="0" y="190">
                {fmt(weightDomain, weightDomain[0] + 0.5)}
              </text>
            </>
          )}
          {pressureDomain && (
            <>
              <text x="0" y="232">
                {Math.round(pressureDomain[1] - 5)}
              </text>
              <text x="0" y="300">
                {Math.round(pressureDomain[0] + 5)}
              </text>
            </>
          )}
          {dateTicks(days).map((i, n, all) => (
            <text
              key={i}
              x={x(i)}
              y="326"
              textAnchor={n === 0 ? "start" : n === all.length - 1 ? "end" : "middle"}
            >
              {short(days[i].date)}
            </text>
          ))}
        </g>
        {[!hasWake && LANES[0], !weightDomain && LANES[1], !pressureDomain && LANES[2]].map(
          lane =>
            lane && (
              <text
                key={lane.kind}
                className="qs-axis-text"
                x={(GUTTER + width) / 2}
                y={(lane.top + lane.bottom) / 2 + 4}
                textAnchor="middle"
              >
                no readings in this range
              </text>
            )
        )}
        {hover !== null && (
          <rect className="qs-crosshair" x={x(hover) - slot / 2} y="0" width={slot} height="310" />
        )}
        <g>
          {days.map((day, i) => {
            const left = x(i) - barWidth / 2;
            if (day.status === "incomplete")
              return (
                <rect
                  key={day.date}
                  className="qs-bar-incomplete"
                  x={left}
                  y="86"
                  width={barWidth}
                  height="4"
                  rx="1"
                />
              );
            if (day.status === "unreviewed")
              return (
                <g key={day.date}>
                  {day.events.length > 0 && (
                    <rect
                      className="qs-bar-unreviewed"
                      x={left}
                      y={wakeY(day.events.length)}
                      width={barWidth}
                      height={90 - wakeY(day.events.length)}
                      rx="2"
                    />
                  )}
                  <rect className="qs-bar-missing" x={left} y="88" width={barWidth} height="2" />
                </g>
              );
            const count = day.awakenings ?? 0;
            return (
              count > 0 && (
                <rect
                  key={day.date}
                  className={`qs-bar${i === peakWake ? " qs-glow" : ""}`}
                  x={left}
                  y={wakeY(count)}
                  width={barWidth}
                  height={90 - wakeY(count)}
                  rx="2"
                />
              )
            );
          })}
        </g>
        {trend.length > 1 && (
          <>
            <path
              d={`${line(trend)} L${trend[trend.length - 1].x},200 L${trend[0].x},200 Z`}
              fill={`url(#${gradient})`}
            />
            <path className="qs-trend" d={line(trend)} />
          </>
        )}
        <g className="qs-dot-weight">
          {weights.map(p => (
            <circle
              key={p.day.date}
              cx={p.x}
              cy={p.y}
              r={hovered === p.day ? 4 : 3}
              className={hovered === p.day ? "qs-glow" : undefined}
            />
          ))}
        </g>
        {systolic.length > 0 && (
          <>
            <path
              className="qs-band"
              d={`${line(systolic)} ${line([...diastolic].reverse()).replace(/^M/, "L")} Z`}
            />
            <path className="qs-line-systolic" d={line(systolic)} />
            <path className="qs-line-diastolic" d={line(diastolic)} />
            <g className="qs-dot-pressure">
              {systolic.map((p, i) => (
                <PressurePair
                  key={p.day.date}
                  systolic={p}
                  diastolic={diastolic[i]}
                  width={width}
                  label={systolic.length === 1}
                />
              ))}
            </g>
          </>
        )}
        {days.length > 0 && (
          <rect
            className="qs-hit"
            x={GUTTER}
            y="0"
            width={Math.max(width - GUTTER, 0)}
            height="310"
            onMouseMove={e => setHover(locate(e).index)}
            onMouseLeave={() => setHover(null)}
            onClick={e => {
              const { index, kind } = locate(e);
              onDay(kind, days[index]);
            }}
          />
        )}
        {hovered && (
          <g className="qs-tooltip" transform={`translate(${tipX},6)`} pointerEvents="none">
            <rect width="150" height="78" rx="8" />
            <text className="qs-tooltip-head" x="12" y="18">
              {hovered.date} · {hovered.status}
            </text>
            <text className="qs-tone-text-awakenings" x="12" y="36">
              ●{" "}
              {hovered.status === "unreviewed"
                ? `${hovered.events.length} recorded`
                : `${hovered.awakenings ?? 0} awakenings`}
            </text>
            <text className="qs-tone-text-weight" x="12" y="52">
              ● {hovered.weight !== null ? `${hovered.weight.toFixed(1)} ${data.unit}` : "—"}
            </text>
            <text className="qs-tone-text-blood-pressure" x="12" y="68">
              ●{" "}
              {hovered.systolic !== null
                ? `${Math.round(hovered.systolic)} / ${Math.round(hovered.diastolic ?? 0)}${
                    hovered.pulse !== null ? ` · ${Math.round(hovered.pulse)}` : ""
                  }`
                : "—"}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function arcPoint(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180;
  return `${(60 + radius * Math.sin(radians)).toFixed(2)},${(60 - radius * Math.cos(radians)).toFixed(2)}`;
}

function WakeClock({ data }: { data: Dashboard | null }) {
  const hours = data?.histogram ?? [];
  const counts = hours.map(h => h.count);
  const events = counts.reduce((sum, c) => sum + c, 0);
  const bins = [0, 1, 2, 3, 4, 5, 6, 7].map(i =>
    counts.slice(i * 3, i * 3 + 3).reduce((s, c) => s + c, 0)
  );
  const maxBin = Math.max(...bins, 0);
  const peakBin = bins.indexOf(maxBin);
  const peakHour = events ? hours[counts.indexOf(Math.max(...counts))].hour : null;
  // Busiest three-hour window anywhere on the noon-to-noon clock.
  let windowStart = 0;
  let windowCount = 0;
  counts.forEach((_, i) => {
    const sum = counts[i] + counts[(i + 1) % 24] + counts[(i + 2) % 24];
    if (sum > windowCount) [windowStart, windowCount] = [i, sum];
  });
  const windowEnd = hours.length ? hours[(windowStart + 3) % 24].hour : "";
  return (
    <section className="qs-panel qs-clock-card">
      <svg
        viewBox="0 0 120 120"
        className="qs-clock"
        role="img"
        aria-label="Awakenings by hour, noon to noon"
      >
        <circle className="qs-clock-ring" cx="60" cy="60" r="50" />
        <circle className="qs-clock-ring" cx="60" cy="60" r="32" />
        <g className="qs-clock-tick">
          <line x1="60" y1="8" x2="60" y2="14" />
          <line x1="112" y1="60" x2="106" y2="60" />
          <line x1="60" y1="112" x2="60" y2="106" />
          <line x1="8" y1="60" x2="14" y2="60" />
        </g>
        <g className="qs-clock-label">
          <text x="60" y="6" textAnchor="middle">
            12p
          </text>
          <text x="120" y="63" textAnchor="end">
            6p
          </text>
          <text x="60" y="119" textAnchor="middle">
            12a
          </text>
          <text x="0" y="63">
            6a
          </text>
        </g>
        {bins.map(
          (count, i) =>
            count > 0 && (
              <path
                key={i}
                className={`qs-wedge${i === peakBin ? " qs-glow" : ""}`}
                d={`M60,60 L${arcPoint(i * 45, 50)} A50,50 0 0,1 ${arcPoint((i + 1) * 45, 50)} Z`}
                fillOpacity={(0.12 + 0.78 * (count / maxBin)).toFixed(2)}
              />
            )
        )}
        <circle className="qs-clock-center" cx="60" cy="60" r="22" />
        <text className="qs-clock-peak" x="60" y="58" textAnchor="middle">
          {data ? (peakHour ?? "—") : "…"}
        </text>
        <text className="qs-clock-caption" x="60" y="70" textAnchor="middle">
          peak hour
        </text>
      </svg>
      <div>
        <h3 className="qs-panel-title qs-small">When you wake</h3>
        <div className="qs-mono-meta">
          noon → noon clock
          <br />
          {data
            ? `${plural(events, "event")} · ${plural(data.summary.total_nights, "night")}`
            : "…"}
          {events > 0 && (
            <>
              <br />
              {Math.round((windowCount / events) * 100)}% between {hours[windowStart].hour}–
              {windowEnd}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const QUEUE_LIMIT = 8;
function ReviewQueue({
  data,
  root,
  onSaved,
  onDay,
  onMore,
}: {
  data: Dashboard | null;
  root: string;
  onSaved: () => void;
  onDay: (kind: Kind, day: Day) => void;
  onMore: () => void;
}) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const now = today();
  const queue = [...(data?.days ?? [])]
    .reverse()
    .filter(d => d.status === "unreviewed" && d.date <= now && !hidden.has(d.date));
  const visible = queue.slice(0, QUEUE_LIMIT);
  // Bulk review only touches the nights on screen, so one click can't zero out a whole range.
  const empty = visible.filter(d => d.events.length === 0);
  async function review(nights: Day[], status: Status) {
    const dates = nights.map(d => d.date);
    setError("");
    setHidden(current => new Set([...current, ...dates]));
    try {
      await api(`${root}nights/review/`, "POST", {
        nights: nights.map(d => ({ date: d.date, revision: d.revision, status })),
      });
    } catch (err) {
      setError(errorText(err));
      setHidden(current => new Set([...current].filter(d => !dates.includes(d))));
    }
    onSaved();
  }
  return (
    <section className="qs-panel qs-review">
      <div className="qs-panel-head">
        <h3 className="qs-panel-title qs-small">Nights awaiting review</h3>
        <span className="qs-panel-meta">
          {data ? queue.length : "…"} · unreviewed = missing, not zero
        </span>
      </div>
      {error && (
        <div className="qs-error" role="alert">
          {error}
        </div>
      )}
      <div className="qs-chips">
        {visible.map(day => (
          <div key={day.date} className="qs-night-chip">
            <button
              className="qs-chip-date"
              aria-label={`Open ${day.date}`}
              onClick={() => onDay("awakenings", day)}
            >
              {short(day.date)}
            </button>
            <span className={day.events.length ? "qs-recorded" : "qs-dim"}>
              · {day.events.length} recorded
            </span>
            <span className="qs-chip-actions">
              <button
                className="qs-mini qs-mini-ok"
                aria-label={`Mark ${day.date} complete`}
                onClick={() => review([day], "complete")}
              >
                ✓ complete
              </button>
              <button
                className="qs-mini"
                aria-label={`Mark ${day.date} incomplete`}
                onClick={() => review([day], "incomplete")}
              >
                incomplete
              </button>
            </span>
          </div>
        ))}
        {queue.length > QUEUE_LIMIT && (
          <button className="qs-night-chip qs-more" onClick={onMore}>
            +{queue.length - QUEUE_LIMIT} more
          </button>
        )}
        {data && !queue.length && <span className="qs-mono-meta">✓ every night is reviewed</span>}
      </div>
      {empty.length > 0 && (
        <div>
          <button className="qs-bulk" onClick={() => review(empty, "complete")}>
            mark {empty.length} empty {empty.length === 1 ? "night" : "nights"} complete
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      )}
    </section>
  );
}

function PressureChart({
  data,
  onDay,
}: {
  data: Dashboard | null;
  onDay: (kind: Kind, day: Day) => void;
}) {
  const [ref, width] = useWidth(1060);
  const days = data?.days ?? [];
  const domain = extent(
    days.flatMap(d => [d.systolic, d.diastolic]),
    8
  );
  const left = 61;
  const slot = (width - left) / Math.max(days.length, 1);
  const x = (i: number) => left + slot * (i + 0.5);
  const y = domain ? scale(domain, [130, 12]) : null;
  const systolic: Point[] = [];
  const diastolic: Point[] = [];
  days.forEach((day, i) => {
    if (!y || day.systolic === null || day.diastolic === null) return;
    systolic.push({ x: x(i), y: y(day.systolic), day });
    diastolic.push({ x: x(i), y: y(day.diastolic), day });
  });
  const ticks = domain
    ? [
        ...new Set(
          [0, 0.5, 1].map(f => Math.round(domain[0] + 8 + f * (domain[1] - domain[0] - 16)))
        ),
      ]
    : [];
  return (
    <section className="qs-panel qs-pressure">
      <div className="qs-panel-head qs-ruled">
        <h3 className="qs-panel-title">Blood pressure</h3>
        <span className="qs-panel-meta">systolic / diastolic · mmHg</span>
      </div>
      <div ref={ref}>
        <svg
          viewBox={`0 0 ${width} 170`}
          height="170"
          role="img"
          aria-label="Daily mean systolic and diastolic blood pressure"
        >
          <g className="qs-grid">
            {ticks.map(t => (
              <line key={t} x1={left} y1={y!(t)} x2={width} y2={y!(t)} />
            ))}
          </g>
          <g className="qs-axis-text">
            {ticks.map(t => (
              <text key={t} x="0" y={y!(t) + 4}>
                {t}
              </text>
            ))}
            {days.length > 0 &&
              dateTicks(days).map((i, n, all) => (
                <text
                  key={i}
                  x={x(i)}
                  y="160"
                  textAnchor={n === 0 ? "start" : n === all.length - 1 ? "end" : "middle"}
                >
                  {short(days[i].date)}
                </text>
              ))}
            {data && !domain && (
              <text x={(left + width) / 2} y="75" textAnchor="middle">
                no readings in this range
              </text>
            )}
          </g>
          {systolic.length > 0 && (
            <>
              <path
                className="qs-band qs-band-soft"
                d={`${line(systolic)} ${line([...diastolic].reverse()).replace(/^M/, "L")} Z`}
              />
              <path className="qs-line-systolic qs-thick" d={line(systolic)} />
              <path className="qs-line-diastolic qs-thick" d={line(diastolic)} />
            </>
          )}
          <g className="qs-dot-pressure qs-clickable">
            {systolic.map((p, i) => (
              <g
                key={p.day.date}
                role="button"
                tabIndex={0}
                aria-label={`${p.day.date}: ${Math.round(p.day.systolic!)}/${Math.round(p.day.diastolic!)} mmHg`}
                onClick={() => onDay("blood-pressure", p.day)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onDay("blood-pressure", p.day);
                  }
                }}
              >
                <PressurePair
                  systolic={p}
                  diastolic={diastolic[i]}
                  width={width}
                  label={systolic.length === 1}
                />
              </g>
            ))}
          </g>
        </svg>
      </div>
      <div className="qs-legend">
        <span>
          <i className="qs-swatch" />
          systolic
        </span>
        <span>
          <i className="qs-swatch qs-faint" />
          diastolic
        </span>
        <span className="qs-legend-total">
          {data
            ? `${plural(data.summary.pressure_readings, "reading")} · ${plural(data.summary.pressure_days, "day")}`
            : "…"}
        </span>
      </div>
    </section>
  );
}

export default function Overview({
  data,
  root,
  unit,
  onAdd,
  onDay,
  onExplore,
  onSaved,
}: {
  data: Dashboard | null;
  root: string;
  unit: string;
  onAdd: (kind: Kind) => void;
  onDay: (kind: Kind, day: Day) => void;
  onExplore: (kind: Kind) => void;
  onSaved: () => void;
}) {
  return (
    <div className="qs-overview">
      <div className="qs-row">
        <div className="qs-rail">
          <Gauges data={data} unit={unit} onExplore={onExplore} />
          <div className="qs-add-row">
            {(
              [
                ["awakenings", "awakening"],
                ["weight", "weight"],
                ["blood-pressure", "pressure"],
              ] as [Kind, string][]
            ).map(([kind, label]) => (
              <button key={kind} className={`qs-add qs-tone-${kind}`} onClick={() => onAdd(kind)}>
                <FontAwesomeIcon icon={faPlus} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <section className="qs-panel qs-timeline-card">
          <div className="qs-panel-head qs-ruled">
            <h3 className="qs-panel-title">Timeline</h3>
            <span className="qs-panel-meta">shared axis · hover a day to cross-read all three</span>
          </div>
          {data ? (
            <Timeline data={data} onDay={onDay} />
          ) : (
            <div className="qs-timeline-chart qs-loading">…</div>
          )}
        </section>
      </div>
      <div className="qs-row">
        <WakeClock data={data} />
        <ReviewQueue
          key={`${data?.days[0]?.date}/${data?.days[data.days.length - 1]?.date}`}
          data={data}
          root={root}
          onSaved={onSaved}
          onDay={onDay}
          onMore={() => onExplore("awakenings")}
        />
      </div>
      <PressureChart data={data} onDay={onDay} />
    </div>
  );
}
