import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import type { Reminder } from "../types";
import { submitDeleteReminder } from "./reminderSubmit";

interface DeleteReminderModalProps {
  open: boolean;
  reminder: Reminder | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteReminderModal({
  open,
  reminder,
  onClose,
  onDeleted,
}: DeleteReminderModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const submit = async () => {
    if (submitting || !reminder) return;
    setSubmitting(true);
    setError(null);
    const result = await submitDeleteReminder(reminder.delete_url);
    setSubmitting(false);
    if (result.success) {
      onDeleted();
      onClose();
    } else {
      setError(result.message ?? "Failed to delete reminder.");
    }
  };

  if (!open || !reminder) return null;

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <div
        className="refined-modal rm-confirm-modal"
        role="dialog"
        aria-label="confirm delete reminder"
      >
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Delete this reminder?</h2>
        <p className="refined-modal-lead">
          <code className="rm-confirm-name">{reminder.name}</code> will be removed. This cannot be
          undone.
        </p>

        {error && (
          <div className="rm-modal-error" role="alert">
            {error}
          </div>
        )}

        <div className="refined-modal-actions compact">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button
            type="button"
            className="refined-btn danger"
            onClick={submit}
            disabled={submitting}
          >
            <FontAwesomeIcon icon={faTrashAlt} className="refined-btn-icon" />
            {submitting ? "deleting…" : "delete"}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

export default DeleteReminderModal;
