import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import {
  DEFAULT_FORM_STATE,
  ReminderFormBody,
  type ReminderFormErrors,
  type ReminderFormState,
} from "./ReminderFormBody";
import { submitReminderForm } from "./reminderSubmit";

interface NewReminderModalProps {
  open: boolean;
  onClose: () => void;
  createUrl: string;
  onCreated: () => void;
}

export function NewReminderModal({ open, onClose, createUrl, onCreated }: NewReminderModalProps) {
  const [state, setState] = useState<ReminderFormState>(DEFAULT_FORM_STATE);
  const [errors, setErrors] = useState<ReminderFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setState(DEFAULT_FORM_STATE);
    setErrors({});
    setSubmitting(false);
    const t = window.setTimeout(() => nameRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
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
    if (submitting) return;
    if (!state.name.trim()) {
      setErrors({ name: ["Name is required."] });
      return;
    }
    setSubmitting(true);
    const result = await submitReminderForm(createUrl, state);
    setSubmitting(false);
    if (result.success) {
      onCreated();
      onClose();
    } else {
      setErrors(result.errors ?? { non_field_errors: [result.message ?? "Failed to save."] });
    }
  };

  if (!open) return null;

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        className="refined-modal rm-form-modal"
        role="dialog"
        aria-label="create new reminder"
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Create a reminder</h2>

        <ReminderFormBody
          idPrefix="rm-new"
          state={state}
          errors={errors}
          onChange={setState}
          nameRef={nameRef}
          onSubmitOnEnter={submit}
        />

        <div className="refined-modal-actions">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button
            type="submit"
            className="refined-btn primary"
            disabled={submitting || !state.name.trim()}
          >
            <FontAwesomeIcon icon={faPlus} className="refined-btn-icon" />
            {submitting ? "creating…" : "create reminder"}
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}

export default NewReminderModal;
