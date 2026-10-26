import React, { useEffect, useState } from "react";
import { api, errorText } from "./api";
import { dateTicks, line, scale, useWidth } from "./chart";
import { ChartTooltip, Kpi, StatusLine, short } from "./Ledger";
import { SleepData, SleepDay, SleepStage } from "./types";

export const stageLabels: Record<SleepStage, string> = {
  awake: "Awake",
  rem: "REM",
  light: "Light / core",
  deep: "Deep",
  asleep: "Asleep, unspecified",
  restless: "Restless",
  in_bed: "In bed",
};
const stages: SleepStage[] = ["awake", "rem", "light", "deep", "asleep", "restless", "in_bed"];
export const duration = (seconds: number | null | undefined) => {
  if (seconds == null) return "—";
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
};
const clock = (stamp: string, zone = "America/New_York") =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(stamp));

export function SleepDurationChart({
  days,
  selected,
  onSelect,
}: {
  days: SleepDay[];
  selected?: string | null;
  onSelect: (date: string) => void;
}) {
  const [ref, width] = useWidth(1000);
  const [hover, setHover] = useState<string | null>(null);
  const left = 42,
    right = 10,
    top = 18,
    bottom = 180,
    height = 210;
  const slot = (width - left - right) / Math.max(days.length, 1);
  const x = (i: number) => left + slot * (i + 0.5);
  const max = Math.max(
    4,
    ...days.flatMap(d => [d.asleep_seconds ?? 0, d.trend_seconds ?? 0]).map(s => s / 3600)
  );
  const ceiling = Math.ceil(max / 2) * 2;
  const y = scale([0, ceiling], [bottom, top]);
  const trend = days.flatMap((day, i) =>
    day.trend_seconds == null ? [] : [{ x: x(i), y: y(day.trend_seconds / 3600) }]
  );
  const hoveredIndex = days.findIndex(d => d.date === hover);
  const hovered = days[hoveredIndex];
  return (
    <div ref={ref} className="qs-sleep-duration">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        height={height}
        role="img"
        aria-label="Nightly sleep duration and seven-day trend"
      >
        <g className="qs-grid">
          {[0, 1, 2, 3, 4].map(n => (
            <line
              key={n}
              x1={left}
              x2={width - right}
              y1={y((ceiling * n) / 4)}
              y2={y((ceiling * n) / 4)}
            />
          ))}
        </g>
        <g className="qs-axis-text">
          {[0, 1, 2, 3, 4].map(n => (
            <text key={n} x="0" y={y((ceiling * n) / 4) + 4}>
              {(ceiling * n) / 4}h
            </text>
          ))}
          {dateTicks(days).map((i, n, ticks) => (
            <text
              key={i}
              x={x(i)}
              y="204"
              textAnchor={n === 0 ? "start" : n === ticks.length - 1 ? "end" : "middle"}
            >
              {short(days[i].date)}
            </text>
          ))}
          {!days.some(d => d.asleep_seconds !== null) && (
            <text x={width / 2} y="100" textAnchor="middle">
              no sleep duration in this range
            </text>
          )}
        </g>
        {days.map((day, i) =>
          day.asleep_seconds == null ? null : (
            <rect
              key={day.date}
              className={`qs-sleep-bar${selected === day.date ? " selected" : ""}`}
              x={x(i) - Math.min(slot * 0.65, 18) / 2}
              y={y(day.asleep_seconds / 3600)}
              width={Math.max(1, Math.min(slot * 0.65, 18))}
              height={Math.max(2, bottom - y(day.asleep_seconds / 3600))}
              rx="2"
              role="button"
              tabIndex={0}
              aria-label={`${day.date}: ${duration(day.asleep_seconds)}; view sleep stages`}
              aria-pressed={selected === day.date}
              onClick={() => onSelect(day.date)}
              onMouseEnter={() => setHover(day.date)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(day.date)}
              onBlur={() => setHover(null)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(day.date);
                }
              }}
            />
          )
        )}
        <path className="qs-sleep-trend" d={line(trend)} pointerEvents="none" />
        {hovered && (
          <ChartTooltip
            x={x(hoveredIndex)}
            y={y((hovered.asleep_seconds ?? 0) / 3600)}
            width={width}
            left={left}
            right={right}
            top={top}
            head={hovered.date}
            body={`${duration(hovered.asleep_seconds)} asleep · trend ${duration(hovered.trend_seconds)}`}
          />
        )}
      </svg>
    </div>
  );
}

export function SleepOverview({
  data,
  loading,
  onOpen,
}: {
  data?: SleepData;
  loading: boolean;
  onOpen: (date?: string) => void;
}) {
  return (
    <section className="qs-panel qs-sleep-overview qs-tone-sleep">
      <div className="qs-panel-head qs-ruled">
        <h3 className="qs-panel-title">Sleep</h3>
        <button className="qs-text-btn" onClick={() => onOpen()}>
          Explore sleep →
        </button>
      </div>
      <div className="qs-sleep-overview-stats">
        <div>
          <span className="qs-muted">Latest in range</span>
          <strong>{loading ? "…" : duration(data?.summary.latest?.asleep_seconds)}</strong>
          <span>{data?.summary.latest?.date ?? "No sleep recorded"}</span>
        </div>
        <div>
          <span className="qs-muted">Average duration</span>
          <strong>{loading ? "…" : duration(data?.summary.mean_seconds)}</strong>
          <span>{data?.summary.nights ?? 0} nights with duration</span>
        </div>
        <div>
          <span className="qs-muted">Source</span>
          <span>{data?.source?.name ?? "Import sleep from Apple Health to get started."}</span>
        </div>
      </div>
      {data && <SleepDurationChart days={data.days} onSelect={onOpen} />}
    </section>
  );
}

export function SleepStageChart({
  day,
  events,
  zone,
}: {
  day: SleepDay;
  events: NonNullable<SleepData["events"]>;
  zone: string;
}) {
  const [ref, width] = useWidth(1000);
  const [hover, setHover] = useState<{
    at: number;
    row: number;
    head: string;
    body: string;
  } | null>(null);
  const intervals = day.intervals ?? [];
  const stamps = [
    ...intervals.flatMap(i => [i.start, i.end]),
    ...events.map(e => e.timestamp),
    ...[day.bedtime, day.wake_time].filter((v): v is string => !!v),
  ].map(s => new Date(s).getTime());
  const first = stamps.length ? Math.min(...stamps) : 0;
  const last = stamps.length ? Math.max(...stamps) : 1;
  const left = 115,
    right = 10,
    top = 28,
    rowHeight = 34,
    height = 300;
  const x = scale([first, last], [left, width - right]);
  const y = (stage: SleepStage) => top + stages.indexOf(stage) * rowHeight;
  return (
    <div ref={ref} className="qs-sleep-stage-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        height={height}
        role="img"
        aria-label={`Sleep stages and logged awakenings for ${day.date}`}
      >
        <g className="qs-grid">
          {stages.map(stage => (
            <line key={stage} x1={left} x2={width - right} y1={y(stage) + 12} y2={y(stage) + 12} />
          ))}
        </g>
        <g className="qs-axis-text">
          {stages.map(stage => (
            <text key={stage} x="0" y={y(stage) + 16}>
              {stageLabels[stage]}
            </text>
          ))}
          {stamps.length > 0 &&
            (width < 550 ? [0, 1] : [0, 0.25, 0.5, 0.75, 1]).map((fraction, i, ticks) => {
              const at = first + (last - first) * fraction;
              return (
                <text
                  key={i}
                  x={x(at)}
                  y="289"
                  textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
                >
                  {clock(new Date(at).toISOString(), zone)}
                </text>
              );
            })}
        </g>
        {intervals.map((interval, i) => {
          const at = new Date(interval.start).getTime(),
            end = new Date(interval.end).getTime();
          const show = () =>
            setHover({
              at,
              row: y(interval.stage),
              head: stageLabels[interval.stage],
              body: `${clock(interval.start, zone)}–${clock(interval.end, zone)} · ${duration((end - at) / 1000)}`,
            });
          return (
            <rect
              key={`${interval.start}-${i}`}
              className={`qs-stage-${interval.stage}`}
              x={x(at)}
              y={y(interval.stage)}
              width={Math.max(1, x(end) - x(at))}
              height="24"
              rx="3"
              tabIndex={0}
              aria-label={`${stageLabels[interval.stage]}, ${clock(interval.start, zone)} to ${clock(interval.end, zone)}`}
              onMouseEnter={show}
              onMouseLeave={() => setHover(null)}
              onFocus={show}
              onBlur={() => setHover(null)}
            />
          );
        })}
        {events.map(event => {
          const at = new Date(event.timestamp).getTime();
          const show = () =>
            setHover({
              at,
              row: top,
              head: "Logged awakening",
              body: `${clock(event.timestamp, zone)} · ${event.source}`,
            });
          return (
            <g
              key={event.uuid}
              tabIndex={0}
              className="qs-sleep-press"
              aria-label={`Logged awakening at ${clock(event.timestamp, zone)}`}
              onMouseEnter={show}
              onMouseLeave={() => setHover(null)}
              onFocus={show}
              onBlur={() => setHover(null)}
            >
              <line x1={x(at)} x2={x(at)} y1="14" y2="266" />
              <circle cx={x(at)} cy="14" r="4" />
              <rect x={x(at) - 5} y="6" width="10" height="260" className="qs-hit" />
            </g>
          );
        })}
        {!intervals.length && (
          <text className="qs-axis-text" x={(left + width) / 2} y="150" textAnchor="middle">
            No stage intervals available for this night.
          </text>
        )}
        {hover && (
          <ChartTooltip
            x={x(hover.at)}
            y={hover.row}
            width={width}
            left={left}
            right={right}
            top={top}
            head={hover.head}
            body={hover.body}
          />
        )}
      </svg>
    </div>
  );
}

export default function Sleep({
  root,
  start,
  end,
  revision,
  initialDate,
  onRange,
  onImport,
}: {
  root: string;
  start: string;
  end: string;
  revision: number;
  initialDate?: string | null;
  onRange: (start: string, end: string) => void;
  onImport: () => void;
}) {
  const [source, setSource] = useState("");
  const [data, setData] = useState<SleepData | null>(null);
  const [night, setNight] = useState<SleepData | null>(null);
  const [selected, setSelected] = useState<string | null>(initialDate ?? null);
  const [error, setError] = useState("");
  const [nightError, setNightError] = useState("");
  const [loading, setLoading] = useState(true);
  const query = new URLSearchParams({ start, end, source }).toString();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setNight(null);
    api<SleepData>(`${root}sleep/summary/?${query}`)
      .then(result => {
        if (!active) return;
        setData(result);
        setSelected(previous =>
          result.days.some(d => d.date === previous && d.bedtime)
            ? previous
            : ([...result.days].reverse().find(d => d.bedtime)?.date ?? null)
        );
      })
      .catch(err => {
        if (active) {
          setError(errorText(err));
          setData(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [root, query, revision]);
  const chosenSource = data?.source?.id;
  useEffect(() => {
    let active = true;
    setNight(null);
    setNightError("");
    if (!selected || chosenSource == null || loading) return;
    api<SleepData>(
      `${root}sleep/night/?${new URLSearchParams({ date: selected, source: String(chosenSource) })}`
    )
      .then(result => {
        if (active) setNight(result);
      })
      .catch(err => {
        if (active) setNightError(errorText(err));
      });
    return () => {
      active = false;
    };
  }, [root, selected, chosenSource, revision, loading]);
  const nights = (data?.days ?? []).filter(d => d.bedtime);
  const current = night?.days[0];
  const selectionIndex = nights.findIndex(d => d.date === selected);
  const latest = data?.summary.latest;
  return (
    <>
      <StatusLine
        start={start}
        end={end}
        loaded={!loading}
        onRange={onRange}
        ranges={[
          [7, "7d"],
          [30, "30d"],
          [90, "90d"],
          [365, "1y"],
        ]}
        summary={
          <div>
            <span className="qs-dim">// </span>range{" "}
            <b>
              {start} → {end}
            </b>{" "}
            · {data?.summary.nights ?? "…"} nights with duration · morning dates ·{" "}
            {data?.timezone ?? "America/New_York"}
          </div>
        }
        controls={
          <label className="qs-control qs-source-filter">
            source:
            <select
              aria-label="Sleep source"
              value={source}
              disabled={loading}
              onChange={e => setSource(e.target.value)}
            >
              <option value="">Latest source</option>
              {(data?.sources ?? []).map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        }
      />
      {error && (
        <p className="qs-error" role="alert">
          {error}
        </p>
      )}
      <div className="qs-kpis qs-kpis-4" aria-busy={loading}>
        <Kpi
          lead
          label="latest sleep"
          value={duration(latest?.asleep_seconds)}
          meta={latest?.date ?? "—"}
        />
        <Kpi
          label="average duration"
          value={duration(data?.summary.mean_seconds)}
          meta={`${data?.summary.nights ?? 0} nights with duration`}
        />
        <Kpi
          label="7-day trend"
          value={duration(latest?.trend_seconds)}
          meta="recorded nights only"
        />
        <Kpi
          label="nights with stages"
          value={String(
            nights.filter(d => d.stages.light + d.stages.deep + d.stages.rem > 0).length
          )}
          meta={data?.source?.name ?? "No source yet"}
        />
      </div>
      <section className="qs-panel qs-sleep-panel" aria-busy={loading}>
        <div className="qs-panel-head qs-ruled">
          <h2 className="qs-panel-title">Sleep duration</h2>
          <span className="qs-panel-meta">bars · time asleep / line · 7-day trend</span>
        </div>
        {data ? (
          <SleepDurationChart days={data.days} selected={selected} onSelect={setSelected} />
        ) : (
          <p className="qs-muted">{loading ? "Loading…" : "Sleep data unavailable."}</p>
        )}
        <p className="qs-muted qs-sleep-caption">
          Morning dates use the same noon-to-noon window as awakenings. Includes naps within that
          window. Missing nights are not zero.
        </p>
      </section>
      {!loading && !nights.length && (
        <section className="qs-panel qs-sleep-panel">
          <p>No sleep recorded for this source and range.</p>
          <button onClick={onImport}>Import Apple Health sleep data</button>
        </section>
      )}
      {nights.length > 0 && (
        <section className="qs-panel qs-sleep-panel" aria-busy={!current && !nightError}>
          <div className="qs-panel-head qs-ruled">
            <h2 className="qs-panel-title">Sleep stages</h2>
            <div className="qs-sleep-night-controls">
              <button
                aria-label="Previous recorded night"
                disabled={selectionIndex <= 0}
                onClick={() => setSelected(nights[selectionIndex - 1].date)}
              >
                ←
              </button>
              <select
                aria-label="Night to inspect"
                value={selected ?? ""}
                onChange={e => setSelected(e.target.value)}
              >
                {[...nights].reverse().map(d => (
                  <option key={d.date} value={d.date}>
                    {d.date}
                  </option>
                ))}
              </select>
              <button
                aria-label="Next recorded night"
                disabled={selectionIndex < 0 || selectionIndex >= nights.length - 1}
                onClick={() => setSelected(nights[selectionIndex + 1].date)}
              >
                →
              </button>
            </div>
          </div>
          {nightError ? (
            <p className="qs-error" role="alert">
              {nightError}
            </p>
          ) : current ? (
            <>
              <p className="qs-muted">
                {current.date} · {duration(current.asleep_seconds)} asleep · {night?.source?.name} ·{" "}
                {night?.events?.length ?? 0} logged awakenings (vertical markers)
              </p>
              <SleepStageChart
                day={current}
                events={night?.events ?? []}
                zone={night?.timezone ?? "America/New_York"}
              />
              <dl className="qs-sleep-breakdown">
                {stages.map(stage => (
                  <div key={stage}>
                    <dt>
                      <i className={`qs-stage-${stage}`} />
                      {stageLabels[stage]}
                    </dt>
                    <dd>{duration(current.stages[stage])}</dd>
                  </div>
                ))}
              </dl>
              <p className="qs-muted qs-sleep-caption">
                Blank gaps have no stage data. Markers are logged awakenings, including button
                presses; device-detected awake intervals are shown separately.{" "}
                {current.duration_basis === "reported" &&
                  "Duration uses the source’s session total; stage totals may differ."}
              </p>
            </>
          ) : (
            <p className="qs-muted">Loading night…</p>
          )}
        </section>
      )}
      {nights.length > 0 && (
        <section className="qs-panel qs-sleep-panel">
          <div className="qs-panel-head qs-ruled">
            <h2 className="qs-panel-title">Recorded nights</h2>
            <span className="qs-panel-meta">{data?.source?.name}</span>
          </div>
          <div className="qs-table-wrap">
            <table className="qs-sleep-table">
              <thead>
                <tr>
                  <th>Morning date</th>
                  <th>Time asleep</th>
                  <th>Light / core</th>
                  <th>Deep</th>
                  <th>REM</th>
                  <th>Awake</th>
                  <th>Logged awakenings</th>
                </tr>
              </thead>
              <tbody>
                {[...nights].reverse().map(day => (
                  <tr key={day.date} className={day.date === selected ? "selected" : ""}>
                    <td>
                      <button
                        className="qs-text-btn"
                        onClick={() => setSelected(day.date)}
                        aria-pressed={day.date === selected}
                      >
                        {day.date}
                      </button>
                    </td>
                    <td>{duration(day.asleep_seconds)}</td>
                    <td>{duration(day.stages.light)}</td>
                    <td>{duration(day.stages.deep)}</td>
                    <td>{duration(day.stages.rem)}</td>
                    <td>{duration(day.stages.awake)}</td>
                    <td>{day.recorded_awakenings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
