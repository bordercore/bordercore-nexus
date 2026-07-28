import React, { useMemo, useState } from "react";
import type { HabitNoteEntry } from "../types";
import { eyebrowDate } from "../utils/format";
import { NotebookEntry } from "./NotebookEntry";

interface NotebookProps {
  /** All notes in the window, newest day first, chronological within a day. */
  notes: HabitNoteEntry[];
  /** ISO date new notes are filed under — follows the heatmap selection. */
  composerDate: string;
  /** ISO of "today", used to label the composer target. */
  todayIso: string;
  /** Maximum entries to display.  Defaults to 8. */
  limit?: number;
  onAdd: (date: string, text: string) => void;
  onUpdate: (uuid: string, text: string) => void;
  onDelete: (uuid: string) => void;
}

/**
 * The habit's running notebook: a composer for the currently-targeted day,
 * then the most recent `limit` notes grouped under their date.
 *
 * Days carry many notes, so the date heading is rendered once per group
 * rather than once per note.
 */
export function Notebook({
  notes,
  composerDate,
  todayIso,
  limit = 8,
  onAdd,
  onUpdate,
  onDelete,
}: NotebookProps) {
  const [draft, setDraft] = useState("");

  const groups = useMemo(() => {
    const byDate: { date: string; entries: HabitNoteEntry[] }[] = [];
    for (const note of notes.slice(0, limit)) {
      const last = byDate[byDate.length - 1];
      if (last && last.date === note.date) last.entries.push(note);
      else byDate.push({ date: note.date, entries: [note] });
    }
    return byDate;
  }, [notes, limit]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onAdd(composerDate, text);
    setDraft("");
  }

  const targetLabel = composerDate === todayIso ? "TODAY" : eyebrowDate(composerDate);

  return (
    <article className="hb-notebook-card">
      <div className="hb-notebook-title">Notebook</div>

      <form className="hb-notebook-composer" onSubmit={handleSubmit}>
        <label className="hb-notebook-composer-label" htmlFor="hb-notebook-input">
          Add note · {targetLabel}
        </label>
        <textarea
          id="hb-notebook-input"
          className="hb-notebook-composer-input"
          rows={2}
          value={draft}
          placeholder="What happened?"
          onChange={e => setDraft(e.target.value)}
        />
        <button
          type="submit"
          className="hb-notebook-composer-submit"
          disabled={draft.trim() === ""}
        >
          Add
        </button>
      </form>

      {groups.length === 0 ? (
        <div className="hb-notebook-empty">No notes yet.</div>
      ) : (
        groups.map(group => (
          <div key={group.date} className="hb-notebook-group">
            <div className="hb-notebook-date">{eyebrowDate(group.date)}</div>
            {group.entries.map(entry => (
              <NotebookEntry
                key={entry.uuid}
                note={entry}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </div>
        ))
      )}
    </article>
  );
}
