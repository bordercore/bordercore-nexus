import React, { useEffect, useRef, useState } from "react";
import { api, errorText } from "./api";
import { Day, Kind } from "./types";
export default function DayDetail({
  day,
  kind,
  unit,
  root,
  onClose,
  onSaved,
}: {
  day: Day;
  kind: Kind;
  unit: string;
  root: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState(day.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
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
          <ul>
            {day.events.map(event => (
              <li key={event.uuid}>
                {event.time}
                {event.note && ` — ${event.note}`}
              </li>
            ))}
          </ul>
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
          <p className="qs-muted">Use reading history to correct or exclude individual events.</p>
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
