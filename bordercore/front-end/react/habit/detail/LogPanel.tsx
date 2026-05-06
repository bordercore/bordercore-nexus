import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import type { HabitLogEntry } from "../types";
import { eyebrowDate } from "../utils/format";

interface LogPanelProps {
  /** ISO date the panel is targeting — today by default, any past date when editing. */
  selectedDate: string;
  /** ISO of "today" (used to choose between TODAY/EDITING modes). */
  todayIso: string;
  /** Existing log row for `selectedDate`, if one exists. */
  existingLog: HabitLogEntry | null;
  /** Empty string means the habit has no `unit` field set; the dose input hides. */
  unit: string;
  onSave: (params: { date: string; completed: boolean; value: string; note: string }) => void;
  onResetToToday: () => void;
}

/**
 * Sticky log entry form.  Operates in two modes:
 *
 * - **Today mode** (`selectedDate === todayIso`): "TODAY · ..." eyebrow,
 *   "Log today" / "Logged for today" headline.
 * - **Editing mode** (`selectedDate !== todayIso`): "EDITING · ..." eyebrow,
 *   "Edit this day" headline with a "back to today" pill-link.
 *
 * Values reset whenever `selectedDate` changes, prefilling from `existingLog`.
 */
export function LogPanel({
  selectedDate,
  todayIso,
  existingLog,
  unit,
  onSave,
  onResetToToday,
}: LogPanelProps) {
  const isEditing = selectedDate !== todayIso;
  const [completed, setCompleted] = useState(true);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  // Re-prefill the form whenever the targeted date or existing-log changes.
  useEffect(() => {
    if (existingLog) {
      setCompleted(existingLog.completed);
      setValue(existingLog.value ?? "");
      setNote(existingLog.note ?? "");
    } else {
      setCompleted(true);
      setValue("");
      setNote("");
    }
  }, [selectedDate, existingLog]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ date: selectedDate, completed, value, note });
  }

  const checkboxClass = `hb-log-checkbox ${completed ? "is-checked" : "is-empty"}`;
  const eyebrow = isEditing
    ? `EDITING · ${eyebrowDate(selectedDate)}`
    : `TODAY · ${eyebrowDate(todayIso)}`;
  let headline: string;
  if (isEditing) headline = "Edit this day";
  else if (existingLog) headline = "Logged for today";
  else headline = "Log today";

  return (
    <form className={`hb-log-panel${isEditing ? " is-editing" : ""}`} onSubmit={handleSubmit}>
      <button
        type="button"
        className={checkboxClass}
        aria-label={completed ? "Mark not completed" : "Mark completed"}
        aria-pressed={completed}
        onClick={() => setCompleted(c => !c)}
      >
        {completed ? "✓" : "+"}
      </button>

      <div className="hb-log-text">
        <div className="hb-log-eyebrow">{eyebrow}</div>
        <div className="hb-log-headline">
          <span>{headline}</span>
          {isEditing && (
            <button type="button" className="hb-log-back-today" onClick={onResetToToday}>
              ← back to today
            </button>
          )}
        </div>
      </div>

      <div className="hb-log-divider" aria-hidden="true" />

      {unit !== "" && (
        <div className="hb-log-field">
          <label className="hb-log-field-label" htmlFor="hb-log-dose">
            Dose
          </label>
          <div className="hb-log-field-row">
            <input
              id="hb-log-dose"
              className="hb-log-input-dose"
              type="number"
              step="any"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="0"
            />
            <span className="hb-log-unit">{unit}</span>
          </div>
        </div>
      )}

      <div className="hb-log-field hb-log-note-cell">
        <label className="hb-log-field-label" htmlFor="hb-log-note">
          Note (optional)
        </label>
        <input
          id="hb-log-note"
          className="hb-log-input-note"
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>

      <button type="submit" className="refined-btn primary">
        <FontAwesomeIcon icon={faPlus} className="refined-btn-icon" />
        save
      </button>
    </form>
  );
}
