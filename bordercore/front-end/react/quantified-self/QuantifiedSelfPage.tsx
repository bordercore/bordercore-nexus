import React, { useEffect, useState } from "react";
import { api, daysBefore, errorText, today } from "./api";
import { Dashboard, Day, Kind, Reading, Tab, TrackerView, labels } from "./types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarAlt } from "@fortawesome/free-solid-svg-icons";
import Overview from "./Overview";
import ReadingForm from "./ReadingForm";
import Imports from "./Imports";
import DayDetail from "./DayDetail";
import Awakenings from "./Awakenings";
import BloodPressure from "./BloodPressure";
import Cardiac from "./Cardiac";
import Sleep from "./Sleep";
import Weight from "./Weight";
import "./quantified-self.css";

const accents: Record<TrackerView, string> = {
  sleep: "blue",
  "resting-heart-rate": "orange",
  hrv: "green",
  awakenings: "purple",
  weight: "cyan",
  "blood-pressure": "pink",
};
const tabs: Tab[] = [
  "overview",
  "sleep",
  "awakenings",
  "weight",
  "blood-pressure",
  "resting-heart-rate",
  "hrv",
  "imports",
];
const ranges: [number, string][] = [
  [7, "7d"],
  [30, "30d"],
  [90, "90d"],
  [365, "1y"],
];
function initial() {
  const p = new URLSearchParams(window.location.search);
  let preferredUnit = "lb";
  try {
    preferredUnit = localStorage.getItem("qs-weight-unit") || "lb";
  } catch {
    /* Storage may be disabled. */
  }
  return {
    tab: tabs.includes(p.get("tab") as Tab) ? (p.get("tab") as Tab) : ("overview" as Tab),
    start: p.get("start") || daysBefore(today(), 29),
    end: p.get("end") || today(),
    unit: (p.get("unit") || preferredUnit) === "kg" ? "kg" : "lb",
  };
}
export default function QuantifiedSelfPage({ root }: { root: string }) {
  const [view, setView] = useState(initial);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState<{
    kind: Kind;
    row?: Reading;
    defaults?: { date?: string; time?: string };
  } | null>(null);
  const [detail, setDetail] = useState<{ kind: Kind; day: Day } | null>(null);
  const [sleepDate, setSleepDate] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [custom, setCustom] = useState(false);
  // Detail pages load their own readings and need no dashboard summary.
  const detailTab = view.tab !== "overview" && view.tab !== "imports" ? view.tab : null;
  const needsSummary = !detailTab;
  const query = new URLSearchParams({
    start: view.start,
    end: view.end,
    unit: view.unit,
  }).toString();
  function refresh() {
    setRevision(n => n + 1);
  }
  function saved(unit?: string) {
    if (unit) setView(current => ({ ...current, unit }));
    setNotice("Saved.");
    refresh();
  }
  useEffect(() => {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ ...view }).toString();
    window.history.replaceState(null, "", url);
    try {
      localStorage.setItem("qs-weight-unit", view.unit);
    } catch {
      /* Storage may be disabled. */
    }
  }, [view]);
  useEffect(() => {
    const handle = () => setView(initial());
    window.addEventListener("popstate", handle);
    return () => window.removeEventListener("popstate", handle);
  }, []);
  useEffect(() => {
    if (!needsSummary) return;
    let active = true;
    setLoading(true);
    setError("");
    api<Dashboard>(`${root}summary/?${query}`)
      .then(value => {
        if (active) setData(value);
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
  }, [root, query, revision, needsSummary]);
  function range(days: number) {
    setView({ ...view, start: daysBefore(today(), days - 1), end: today() });
  }
  const summary = data?.summary;
  const preset = ranges.find(([days]) => view.start === daysBefore(view.end, days - 1));
  const awaiting = data?.days.filter(d => d.status === "unreviewed" && d.date <= today()).length;
  return (
    <main className={`qs-page${detailTab ? ` qs-accent-${accents[detailTab]}` : ""}`}>
      <div className="qs-shell">
        <header className="qs-header">
          <div className="qs-title">
            <h1>
              {detailTab === "sleep" ? "Sleep" : detailTab ? labels[detailTab] : "Quantified Self"}
            </h1>
            <div className="qs-crumbs">
              bordercore <span>/</span> quantified-self <span>/</span> <b>{view.tab}</b>
            </div>
          </div>
          <nav className="qs-tabs" aria-label="Quantified Self views">
            {tabs.map(tab => (
              <button
                key={tab}
                aria-current={view.tab === tab ? "page" : undefined}
                className={view.tab === tab ? "active" : ""}
                onClick={() => {
                  setView({ ...view, tab });
                  setNotice("");
                }}
              >
                {tab === "resting-heart-rate" ? "resting heart rate" : tab}
              </button>
            ))}
          </nav>
        </header>
        {needsSummary && (
          <div className="qs-statusline">
            <div>
              <span className="qs-dim">// </span>range{" "}
              <b>
                {view.start} → {view.end}
              </b>{" "}
              · tz <b>{data?.timezone ?? "America/New_York"}</b>
              {summary && (
                <>
                  {" "}
                  · {summary.total_nights} nights ·{" "}
                  <span className="qs-ok-text">{summary.completed_nights} complete</span> ·{" "}
                  <span className="qs-warn-text">{awaiting} awaiting review</span>
                </>
              )}{" "}
              · unit{" "}
              <button
                className="qs-unit"
                aria-label={`Weight unit ${view.unit}; switch to ${view.unit === "lb" ? "kg" : "lb"}`}
                onClick={() => setView({ ...view, unit: view.unit === "lb" ? "kg" : "lb" })}
              >
                {view.unit}
              </button>
            </div>
            <div className="qs-ranges">
              {ranges.map(([days, label]) => (
                <button
                  key={days}
                  className={!custom && preset?.[0] === days ? "active" : ""}
                  aria-pressed={!custom && preset?.[0] === days}
                  onClick={() => {
                    setCustom(false);
                    range(days);
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
            </div>
          </div>
        )}
        {needsSummary && custom && (
          <div className="qs-toolbar">
            <label>
              From
              <input
                type="date"
                value={view.start}
                onChange={e => {
                  if (e.target.value) setView({ ...view, start: e.target.value });
                }}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={view.end}
                onChange={e => {
                  if (e.target.value) setView({ ...view, end: e.target.value });
                }}
              />
            </label>
          </div>
        )}
        {notice && (
          <p className="qs-success" role="status">
            {notice}
          </p>
        )}
        {needsSummary && error && (
          <p className="qs-error" role="alert">
            {error} <button onClick={refresh}>Retry</button>
          </p>
        )}
        {view.tab === "sleep" ? (
          <Sleep
            root={root}
            start={view.start}
            end={view.end}
            revision={revision}
            initialDate={sleepDate}
            onRange={(start, end) => setView({ ...view, start, end })}
            onImport={() => setView({ ...view, tab: "imports" })}
          />
        ) : view.tab === "awakenings" ? (
          <Awakenings
            root={root}
            start={view.start}
            end={view.end}
            revision={revision}
            onRange={(start, end) => setView({ ...view, start, end })}
            onAdd={defaults => setForm({ kind: "awakenings", defaults })}
            onEdit={row => setForm({ kind: "awakenings", row })}
            onChanged={refresh}
          />
        ) : view.tab === "blood-pressure" ? (
          <BloodPressure
            root={root}
            start={view.start}
            end={view.end}
            revision={revision}
            onRange={(start, end) => setView({ ...view, start, end })}
            onAdd={() => setForm({ kind: "blood-pressure" })}
            onEdit={row => setForm({ kind: "blood-pressure", row })}
            onChanged={refresh}
          />
        ) : view.tab === "weight" ? (
          <Weight
            root={root}
            start={view.start}
            end={view.end}
            unit={view.unit === "kg" ? "kg" : "lb"}
            revision={revision}
            onRange={(start, end) => setView({ ...view, start, end })}
            onUnit={unit => setView({ ...view, unit })}
            onAdd={() => setForm({ kind: "weight" })}
            onEdit={row => setForm({ kind: "weight", row })}
            onChanged={refresh}
          />
        ) : view.tab === "resting-heart-rate" || view.tab === "hrv" ? (
          <Cardiac
            key={view.tab}
            kind={view.tab}
            root={root}
            start={view.start}
            end={view.end}
            revision={revision}
            onRange={(start, end) => setView({ ...view, start, end })}
            onAdd={() => setForm({ kind: view.tab as Kind })}
            onEdit={row => setForm({ kind: view.tab as Kind, row })}
            onChanged={refresh}
          />
        ) : view.tab === "imports" ? (
          <Imports root={root} onSaved={saved} />
        ) : view.tab === "overview" ? (
          <div aria-busy={loading}>
            <Overview
              data={data}
              root={root}
              unit={view.unit}
              onAdd={kind => setForm({ kind })}
              onDay={(kind, day) => setDetail({ kind, day })}
              onExplore={(kind, date) => {
                setSleepDate(date ?? null);
                setView({ ...view, tab: kind });
              }}
              onSaved={refresh}
            />
          </div>
        ) : null}
      </div>
      {form && (
        <ReadingForm
          key={`${form.kind}-${form.row?.uuid || "new"}`}
          {...form}
          root={root}
          unit={view.unit}
          onSaved={saved}
          onClose={() => setForm(null)}
        />
      )}
      {detail && (
        <DayDetail
          {...detail}
          unit={view.unit}
          root={root}
          revision={revision}
          onSaved={saved}
          onEdit={row => setForm({ kind: detail.kind, row })}
          onClose={() => setDetail(null)}
        />
      )}
    </main>
  );
}
