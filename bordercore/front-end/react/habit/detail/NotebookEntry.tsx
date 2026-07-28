import React, { useState } from "react";
import type { HabitNoteEntry } from "../types";

interface NotebookEntryProps {
  note: HabitNoteEntry;
  onUpdate: (uuid: string, text: string) => void;
  onDelete: (uuid: string) => void;
}

/**
 * One note in the Notebook, in one of three states:
 *
 * - **view** — clock time (when the note was written on its own day) and text
 * - **editing** — textarea with save / cancel
 * - **confirming** — "delete?" with yes / no
 *
 * Deletion confirms inline rather than through window.confirm, which blocks
 * the page and cannot be styled.
 */
export function NotebookEntry({ note, onUpdate, onDelete }: NotebookEntryProps) {
  const [mode, setMode] = useState<"view" | "editing" | "confirming">("view");
  const [draft, setDraft] = useState(note.note);

  function beginEditing() {
    setDraft(note.note);
    setMode("editing");
  }

  function save() {
    const text = draft.trim();
    // Blanking is a delete, which has its own affordance; treat it as a cancel.
    if (text && text !== note.note) onUpdate(note.uuid, text);
    setMode("view");
  }

  if (mode === "editing") {
    return (
      <div className="hb-notebook-entry is-editing">
        <textarea
          className="hb-notebook-edit-input"
          value={draft}
          rows={3}
          aria-label="Edit note"
          onChange={e => setDraft(e.target.value)}
        />
        <div className="hb-notebook-entry-actions">
          <button type="button" className="hb-notebook-action" onClick={save}>
            save
          </button>
          <button type="button" className="hb-notebook-action" onClick={() => setMode("view")}>
            cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hb-notebook-entry">
      <div className="hb-notebook-note">{note.note}</div>
      <div className="hb-notebook-entry-foot">
        {note.time && <span className="hb-notebook-time">{note.time}</span>}
        {mode === "confirming" ? (
          <span className="hb-notebook-entry-actions">
            <span className="hb-notebook-confirm-label">delete?</span>
            <button
              type="button"
              className="hb-notebook-action is-danger"
              onClick={() => onDelete(note.uuid)}
            >
              yes
            </button>
            <button type="button" className="hb-notebook-action" onClick={() => setMode("view")}>
              no
            </button>
          </span>
        ) : (
          <span className="hb-notebook-entry-actions">
            <button type="button" className="hb-notebook-action" onClick={beginEditing}>
              edit
            </button>
            <button
              type="button"
              className="hb-notebook-action"
              onClick={() => setMode("confirming")}
            >
              delete
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
