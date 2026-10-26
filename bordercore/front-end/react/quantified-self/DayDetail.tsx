import React, { useEffect, useRef, useState } from "react";
import { api, errorText } from "./api";
import { Day, Kind, Reading, cardiacMetrics } from "./types";
export default function DayDetail({
  day,
  kind,
  unit,
  root,
  revision = 0,
  onClose,
  onSaved,
  onEdit,
}: {
  day: Day;
  kind: Kind;
  unit: string;
  root: string;
  revision?: number;
  onClose: () => void;
  onSaved: () => void;
  onEdit?: (row: Reading) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState(day.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Every awakening recorded for the night, including excluded ones, so they
  // can be corrected, removed or restored here.
  const [events, setEvents] = useState<Reading[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    if (kind !== "awakenings") return;
    let active = true;
    api<{ results: Reading[] }>(
      `${root}awakenings/records/?start=${day.date}&end=${day.date}&limit=1000`
    )
      .then(value => {
        if (active) setEvents([...value.results].reverse());
      })
      .catch(err => {
        if (active) setError(errorText(err));
      });
    return () => {
      active = false;
    };
  }, [kind, root, day.date, revision]);
  async function change(request: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await request();
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }
  async function save() {
    setBusy(true);
    try {
      await api(`${root}nights/review/`, "POST", {
        nights: [{ date: day.date, revision: day.revision, status: day.status, note }],
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="qs-dialog"
      onCancel={e => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="qs-day-title"
    >
      <div className="qs-dialog-head">
        <h2 id="qs-day-title">
          {kind === "awakenings" ? "Night ending " : ""}
          {day.date}
        </h2>
        <button disabled={busy} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {kind === "awakenings" ? (
        <>
          <p>
            {day.awakenings ?? "No"} recorded awakenings · {day.status}
          </p>
          {events === null ? (
            <p className="qs-muted">…</p>
          ) : (
            <ul className="qs-night-events">
              {events.map(event => (
                <li key={event.uuid} className={event.excluded ? "qs-night-event-excluded" : ""}>
                  <span className="qs-night-event-time">{event.timestamp?.slice(11, 19)}</span>
                  <span className="qs-source">{event.source}</span>
                  <span className="qs-night-event-note">
                    {event.excluded ? "excluded" : ""}
                    {event.excluded && event.note ? " · " : ""}
                    {event.note}
                  </span>
                  {confirming === event.uuid ? (
                    <>
                      <button
                        className="qs-text-btn qs-danger-text"
                        disabled={busy}
                        onClick={() =>
                          change(() => api(`${root}awakenings/records/${event.uuid}/`, "DELETE"))
                        }
                      >
                        delete · cannot be undone
                      </button>
                      <button className="qs-text-btn" onClick={() => setConfirming(null)}>
                        cancel
                      </button>
                    </>
                  ) : event.excluded ? (
                    <button
                      className="qs-text-btn qs-restore"
                      disabled={busy}
                      onClick={() =>
                        change(() =>
                          api(`${root}awakenings/records/${event.uuid}/`, "PATCH", {
                            excluded: false,
                          })
                        )
                      }
                    >
                      restore
                    </button>
                  ) : (
                    <>
                      {onEdit && (
                        <button className="qs-text-btn" onClick={() => onEdit(event)}>
                          edit
                        </button>
                      )}
                      <button className="qs-text-btn" onClick={() => setConfirming(event.uuid)}>
                        delete
                      </button>
                    </>
                  )}
                </li>
              ))}
              {!events.length && <li className="qs-muted">No awakenings recorded.</li>}
            </ul>
          )}
          <label>
            Night note
            <textarea
              rows={3}
              maxLength={10000}
              value={note}
              disabled={busy}
              onChange={e => setNote(e.target.value)}
            />
          </label>
          <button className="qs-primary" disabled={busy} onClick={save}>
            Save note
          </button>
        </>
      ) : (
        <ul>
          {kind === "weight"
            ? day.weight_samples.map(r => (
                <li key={r.uuid}>
                  {r.value.toFixed(3)} {unit} · {r.time}
                </li>
              ))
            : kind === "hrv" || kind === "resting-heart-rate"
              ? (day[`${cardiacMetrics[kind].key}_samples`] ?? []).map(r => (
                  <li key={r.uuid}>
                    {r.value.toFixed(1)} {cardiacMetrics[kind].unit} · {r.time}
                  </li>
                ))
              : day.pressure_samples.map(r => (
                  <li key={r.uuid}>
                    {r.systolic}/{r.diastolic} mmHg{r.pulse ? ` · ${r.pulse} bpm` : ""} · {r.time}
                  </li>
                ))}
        </ul>
      )}
      {error && (
        <p className="qs-error" role="alert">
          {error}
        </p>
      )}
    </dialog>
  );
}
