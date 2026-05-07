import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { RefinedDatePicker } from "../common/RefinedDatePicker";
import { doPost } from "../utils/reactUtils";
import { todayIso } from "./utils/format";
import type { HabitSummary } from "./types";

interface CreateHabitModalProps {
  open: boolean;
  onClose: () => void;
  createUrl: string;
  onCreated: (habit: HabitSummary) => void;
}

/**
 * Refined-style "new habit" modal — same portal-rendered shell as
 * NewTodoModal / EditTodoModal so dialogs feel consistent across the app.
 *
 * Open state is owned by the parent (`open` + `onClose`); we don't expose
 * an imperative handle.
 */
export function CreateHabitModal({ open, onClose, createUrl, onCreated }: CreateHabitModalProps) {
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startDate, setStartDate] = useState(todayIso());

  const nameRef = useRef<HTMLInputElement>(null);

  // Reset state every time the modal opens. Mirrors NewTodoModal.
  useEffect(() => {
    if (!open) return;
    setName("");
    setPurpose("");
    setStartDate(todayIso());
    const t = window.setTimeout(() => nameRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  // ESC closes.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const canSubmit = name.trim().length > 0;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    doPost(
      createUrl,
      {
        name: name.trim(),
        purpose: purpose.trim(),
        start_date: startDate,
      },
      response => {
        onCreated(response.data.habit as HabitSummary);
        onClose();
      },
      "Habit created"
    );
  }, [canSubmit, createUrl, name, purpose, startDate, onCreated, onClose]);

  const handlePurposeInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = "";
    target.style.height = `${target.scrollHeight + 3}px`;
  };

  if (!open) return null;

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        className="refined-modal"
        role="dialog"
        aria-label="create new habit"
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Create a habit</h2>

        <div className="refined-field">
          <label htmlFor="habit-new-name">name</label>
          <input
            ref={nameRef}
            id="habit-new-name"
            type="text"
            autoComplete="off"
            maxLength={200}
            placeholder="e.g. Vitamin D 3000 IU per day"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            required
          />
        </div>

        <div className="refined-field">
          <label htmlFor="habit-new-start-date">start date</label>
          <RefinedDatePicker id="habit-new-start-date" value={startDate} onChange={setStartDate} />
        </div>

        <div className="refined-field">
          <label htmlFor="habit-new-purpose">
            purpose <span className="optional">· optional</span>
          </label>
          <textarea
            id="habit-new-purpose"
            placeholder="why are you tracking this? markdown supported."
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            onInput={handlePurposeInput}
          />
        </div>

        <div className="refined-modal-actions">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="submit" className="refined-btn primary" disabled={!canSubmit}>
            <FontAwesomeIcon icon={faPlus} className="refined-btn-icon" />
            create habit
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}

export default CreateHabitModal;
