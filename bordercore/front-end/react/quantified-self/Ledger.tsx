// Shared building blocks for the per-tracker detail pages ("ledger" layout):
// status line, KPI tile, chart tooltip, readings table and record loading.
import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarAlt,
  faPencilAlt,
  faPlus,
  faSearch,
  faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
import { api, daysBefore, errorText, today } from "./api";
import { Kind, Reading } from "./types";

export const RANGES: [number, string][] = [
  [30, "30d"],
  [90, "90d"],
  [365, "1y"],
  // The API caps a range at ten years, which stands in for "all".
  [3660, "all"],
];
export const ALL_DAYS = 3660;
const PAGE = 20;
export const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
export const short = (date: string) => date.slice(5);
export const clock = (reading: Reading) => (reading.time ? reading.time.slice(0, 5) : "");
export const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
export const stamp = (r: Reading) => `${r.date} ${r.time || ""}`;

export function datesBetween(start: string, end: string) {
  const dates: string[] = [];
  for (let day = start; day <= end && dates.length <= ALL_DAYS; day = daysBefore(day, -1)) {
    dates.push(day);
  }
  return dates;
}
export function rangePreset(start: string, end: string, ranges = RANGES) {
  return ranges.find(([days]) => start === daysBefore(end, days - 1))?.[0];
}
export function latestReading<T extends Reading>(readings: T[]) {
  return readings.reduce<T | null>((best, r) => (!best || stamp(r) > stamp(best) ? r : best), null);
}

/** Loads every record in a range and applies optimistic delete/restore. */
export function useRecords(
  root: string,
  kind: Kind,
  query: string,
  revision: number,
  onChanged: () => void
) {
  const [rows, setRows] = useState<Reading[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    async function load() {
      const collected: Reading[] = [];
      let offset = 0;
      while (active) {
        const page = await api<{ count?: number; results: Reading[] }>(
          `${root}${kind}/records/?${query}&limit=20000${offset ? `&offset=${offset}` : ""}`
        );
        collected.push(...page.results);
        offset += page.results.length;
        if (!page.results.length || offset >= (page.count ?? offset)) break;
      }
      if (active) setRows(collected);
    }
    load().catch(err => {
      if (active) setError(errorText(err));
    });
    return () => {
      active = false;
    };
  }, [root, kind, query, revision]);
  async function mutate(next: Reading[], request: () => Promise<unknown>) {
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
  const url = (row: Reading) => `${root}${kind}/records/${row.uuid}/`;
  return {
    rows,
    error,
    remove: (row: Reading) =>
      mutate(
        (rows ?? []).filter(r => r.uuid !== row.uuid),
        () => api(url(row), "DELETE")
      ),
    restore: (row: Reading) =>
      mutate(
        (rows ?? []).map(r => (r.uuid === row.uuid ? { ...r, excluded: false } : r)),
        () => api(url(row), "PATCH", { excluded: false })
      ),
  };
}

export function StatusLine({
  start,
  end,
  loaded,
  readings,
  days,
  excluded,
  sources,
  extra,
  summary,
  ranges = RANGES,
  controls,
  addLabel = "reading",
  onRange,
  onAdd,
}: {
  start: string;
  end: string;
  loaded: boolean;
  readings?: number;
  days?: number;
  excluded?: number;
  sources?: string[];
  extra?: React.ReactNode;
  /** Replaces the default "range … · N readings on N days" text. */
  summary?: React.ReactNode;
  ranges?: [number, string][];
  controls?: React.ReactNode;
  addLabel?: React.ReactNode;
  onRange: (start: string, end: string) => void;
  onAdd?: () => void;
}) {
  const preset = rangePreset(start, end, ranges);
  const [custom, setCustom] = useState(false);
  // The API rejects reversed ranges and spans over ten years, so ignore those
  // edits instead of sending a request that can only fail.
  const pick = (from: string, to: string) => {
    if (from && to && from <= to && datesBetween(from, to).length <= ALL_DAYS) onRange(from, to);
  };
  return (
    <>
      <div className="qs-statusline">
        {summary ?? (
          <div>
            <span className="qs-dim">// </span>range{" "}
            <b>
              {start} → {end}
            </b>{" "}
            · {plural(datesBetween(start, end).length, "day")}
            {loaded && days !== undefined && (
              <>
                {" "}
                · <b>{plural(readings ?? 0, "reading")}</b> on <b>{days}</b>{" "}
                {days === 1 ? "day" : "days"} · {excluded} excluded
                {sources && sources.length > 0 && (
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
            {extra}
          </div>
        )}
        <div className="qs-ranges">
          {ranges.map(([count, label]) => (
            <button
              key={count}
              className={!custom && preset === count ? "active" : ""}
              aria-pressed={!custom && preset === count}
              onClick={() => {
                setCustom(false);
                onRange(daysBefore(today(), count - 1), today());
              }}
            >
              {label}
            </button>
          ))}
          <button
            className={`qs-custom${custom || !preset ? " active" : ""}`}
            aria-expanded={custom}
            onClick={() => setCustom(!custom)}
          >
            <FontAwesomeIcon icon={faCalendarAlt} />
            custom…
          </button>
          {controls}
          {onAdd && (
            <button className="qs-cta" onClick={onAdd}>
              <FontAwesomeIcon icon={faPlus} />
              {addLabel}
            </button>
          )}
        </div>
      </div>
      {custom && (
        <div className="qs-toolbar">
          <label>
            From
            <input type="date" value={start} max={end} onChange={e => pick(e.target.value, end)} />
          </label>
          <label>
            To
            <input
              type="date"
              value={end}
              min={start}
              max={today()}
              onChange={e => pick(start, e.target.value)}
            />
          </label>
        </div>
      )}
    </>
  );
}

export function Kpi({
  label,
  value,
  unit,
  meta,
  lead = false,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  meta: React.ReactNode;
  lead?: boolean;
  tone?: string;
}) {
  return (
    <div className={`qs-kpi${lead ? " qs-kpi-lead" : ""}`}>
      <div className="qs-kpi-label">{label}</div>
      <div className="qs-kpi-value">
        <span className={tone ? `qs-${tone}-text` : undefined}>{value}</span>
        {unit && value !== "—" && <span className="qs-kpi-unit">{unit}</span>}
      </div>
      <div className="qs-kpi-meta">{meta}</div>
    </div>
  );
}

/** A two-line hover card, kept inside the plot horizontally and flipped below the point near the top. */
export function ChartTooltip({
  x,
  y,
  head,
  body,
  width,
  left,
  right,
  top,
}: {
  x: number;
  y: number;
  head: string;
  body: string;
  width: number;
  left: number;
  right: number;
  top: number;
}) {
  const boxWidth = Math.max(head.length * 6.2, body.length * 6.1) + 24;
  const tx = Math.min(Math.max(x - boxWidth / 2, left), width - right - boxWidth);
  const ty = y - 58 < top ? y + 14 : y - 58;
  return (
    <g
      className="qs-tooltip qs-tooltip-accent"
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

export type Metric = {
  key: string;
  label: string;
  sort: (row: Reading) => number;
  render: (row: Reading) => React.ReactNode;
  className?: (row: Reading) => string;
};
export type Flag = { label: string; tone: "warn" | "danger" | "neutral" };

export function ReadingsTable({
  loading = false,
  kind,
  title,
  rows,
  root,
  exportQuery,
  metrics,
  flag,
  showExcluded,
  onShowExcluded,
  selectedDay,
  onClearDay,
  onEdit,
  onDelete,
  onRestore,
}: {
  loading?: boolean;
  kind: Kind;
  title: string;
  rows: Reading[];
  root: string;
  exportQuery: string;
  metrics: Metric[];
  flag: (row: Reading) => Flag | null;
  showExcluded: boolean;
  onShowExcluded: (show: boolean) => void;
  selectedDay: string | null;
  onClearDay: () => void;
  onEdit: (row: Reading) => void;
  onDelete: (row: Reading) => void;
  onRestore: (row: Reading) => void;
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 }>({ col: "date", dir: -1 });
  const [visible, setVisible] = useState(PAGE);
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim().toLowerCase()), 200);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => setVisible(PAGE), [query, source, showExcluded, selectedDay, sort]);
  const sources = [...new Set(rows.map(r => r.source))].sort();
  const excludedCount = rows.filter(r => r.excluded).length;
  const metric = metrics.find(m => m.key === sort.col);
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
        metric
          ? metric.sort(r)
          : sort.col === "time"
            ? r.time || ""
            : sort.col === "source"
              ? r.source.toLowerCase()
              : stamp(r);
      const [ka, kb] = [key(a), key(b)];
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * sort.dir;
    });
  const shown = filtered.slice(0, visible);
  const exportUrl = `${root}${kind}/export/?${exportQuery}${source ? `&source=${encodeURIComponent(source)}` : ""}`;
  const header = (col: string | null, label: string, numeric = false) => (
    <div
      role="columnheader"
      key={label}
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
            onClick={() => onShowExcluded(!showExcluded)}
          >
            {showExcluded ? "●" : "○"} show excluded
          </button>
          <a className="qs-control qs-export" href={exportUrl}>
            export csv
          </a>
        </div>
      </div>
      <div
        role="table"
        aria-label={title}
        aria-busy={loading}
        className={`qs-ledger qs-ledger-${kind}`}
      >
        <div role="row" className="qs-ledger-row qs-ledger-head">
          {header("date", "date")}
          {header("time", "time")}
          {metrics.map(m => header(m.key, m.label, true))}
          {header("source", "source")}
          {header(null, "note")}
          <div role="columnheader">
            <span className="qs-visually-hidden">actions</span>
          </div>
        </div>
        {shown.map(row => {
          const flagged = row.excluded ? null : flag(row);
          const tint = flagged && flagged.tone !== "neutral" ? ` qs-ledger-${flagged.tone}` : "";
          return (
            <div
              role="row"
              key={row.uuid}
              className={`qs-ledger-row${row.excluded ? " qs-ledger-excluded" : ""}${tint}`}
            >
              <div role="cell" className="qs-strong">
                {row.date}
              </div>
              <div role="cell">{clock(row) || "—"}</div>
              {metrics.map(m => (
                <div role="cell" key={m.key} className={`qs-num ${m.className?.(row) ?? ""}`}>
                  {m.render(row)}
                </div>
              ))}
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
                        {flagged && (
                          <span className={`qs-badge qs-badge-${flagged.tone}`}>
                            {flagged.label}
                          </span>
                        )}
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
        {!filtered.length && !loading && (
          <div role="row" className="qs-ledger-row qs-ledger-empty">
            <div role="cell">No readings match your filter.</div>
          </div>
        )}
      </div>
      <div className="qs-ledger-foot">
        <span>
          {loading
            ? "…"
            : `showing ${shown.length} of ${filtered.length}${excludedCount > 0 ? ` · ${excludedCount} excluded` : ""}`}
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

export function scrollToReadings() {
  document.getElementById("qs-readings")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

export function Toggle({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`qs-toggle${on ? " on" : ""}`} aria-pressed={on} onClick={onClick}>
      {on ? "●" : "○"} {label}
    </button>
  );
}

/** The item whose x position is closest to the pointer, in viewBox units. */
export function nearest<T>(
  event: React.MouseEvent<SVGElement>,
  width: number,
  items: T[],
  x: (item: T) => number
) {
  const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
  const px = ((event.clientX - box.left) / (box.width || width)) * width;
  let best: T | null = null;
  for (const item of items)
    if (best === null || Math.abs(x(item) - px) < Math.abs(x(best) - px)) best = item;
  return best;
}
