import React, { useState } from "react";
import { doPost } from "../../utils/reactUtils";
import type { LoggedSet } from "../types";

interface LogSetCardProps {
  hasWeight: boolean;
  hasDuration: boolean;
  logSetUrl: string;
  deleteSetUrl: string;
  defaultWeight: string;
  defaultReps: string;
  defaultDuration: string;
}

export function LogSetCard({
  hasWeight,
  hasDuration,
  logSetUrl,
  deleteSetUrl,
  defaultWeight,
  defaultReps,
  defaultDuration,
}: LogSetCardProps) {
  const [weight, setWeight] = useState<string>(defaultWeight);
  const [reps, setReps] = useState<string>(defaultReps);
  const [duration, setDuration] = useState<string>(defaultDuration);
  const [note, setNote] = useState<string>("");
  const [sets, setSets] = useState<LoggedSet[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  function resetFields() {
    setWeight(defaultWeight);
    setReps(defaultReps);
    setDuration(defaultDuration);
    setNote("");
  }

  function submit() {
    const repsInt = parseInt(reps, 10);
    if (!Number.isFinite(repsInt) || repsInt <= 0) return;
    if (submitting) return;
    setSubmitting(true);
    doPost(
      logSetUrl,
      {
        weight: hasWeight ? weight : "0",
        reps: String(repsInt),
        duration: hasDuration ? duration : "0",
        note,
      },
      response => {
        const created = response.data.set as LoggedSet;
        setSets(cur => [...cur, { ...created, new: true }]);
        setNote("");
        setSubmitting(false);
        window.setTimeout(() => {
          setSets(cur => cur.map(s => (s.id === created.id ? { ...s, new: false } : s)));
        }, 1200);
      },
      "",
      "Error logging set"
    );
    // Optimistic UX: if doPost fails, we clear submitting via onerror; simplest
    // safeguard is a soft timeout.
    window.setTimeout(() => setSubmitting(false), 4000);
  }

  function remove(id: number) {
    doPost(
      deleteSetUrl,
      { id: String(id) },
      () => setSets(cur => cur.filter(s => s.id !== id)),
      "",
      "Error removing set"
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="ex-card accent">
      <h3>
        <span>log set</span>
        <span className="ex-card-hint">{sets.length} today</span>
      </h3>
      <div className="ex-composer" onKeyDown={onKeyDown}>
        <div className="row">
          {hasWeight && (
            <div>
              <label htmlFor="log-weight">weight · lb</label>
              <input
                id="log-weight"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={weight}
                onChange={e => setWeight(e.target.value)}
              />
            </div>
          )}
          <div>
            <label htmlFor="log-reps">reps</label>
            <input
              id="log-reps"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={reps}
              onChange={e => setReps(e.target.value)}
            />
          </div>
          {hasDuration && (
            <div>
              <label htmlFor="log-duration">duration · sec</label>
              <input
                id="log-duration"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={duration}
                onChange={e => setDuration(e.target.value)}
              />
            </div>
          )}
        </div>
        <div>
          <label htmlFor="log-note">note · optional</label>
          <textarea
            id="log-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="form cue, tempo, partials…"
          />
        </div>
        <div className="submit-row">
          <span className="hint">⌘↵ to log</span>
          <button type="button" className="ex-btn" onClick={resetFields}>
            reset
          </button>
          <button type="button" className="ex-btn primary" onClick={submit} disabled={submitting}>
            <span className="icon">+</span> log set
          </button>
        </div>
      </div>

      <div className="ex-log-table">
        <div className="ex-log-head">
          <span>#</span>
          <span>{hasWeight ? "weight" : "duration"}</span>
          <span>reps</span>
          <span aria-hidden />
        </div>
        {sets.length === 0 ? (
          <div className="ex-log-empty">// no sets logged yet — logged sets appear here</div>
        ) : (
          <div className="ex-log">
            {sets.map((s, i) => (
              <div key={s.id} className={`ex-log-row ${s.new ? "new" : ""}`}>
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <span className="w">
                  {hasWeight ? (
                    <>
                      {s.weight}
                      <span className="u">lb</span>
                    </>
                  ) : (
                    <>
                      {s.duration}
                      <span className="u">s</span>
                    </>
                  )}
                </span>
                <span className="r">{s.reps}</span>
                <button
                  type="button"
                  className="ex-log-x"
                  onClick={() => remove(s.id)}
                  title="remove"
                  aria-label={`remove set ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
