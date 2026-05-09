import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import type { Reminder } from "../types";
import {
  DEFAULT_FORM_STATE,
  ReminderFormBody,
  type ReminderFormErrors,
  type ReminderFormState,
} from "./ReminderFormBody";
import { submitReminderForm } from "./reminderSubmit";

interface EditReminderModalProps {
  open: boolean;
  reminder: Reminder | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormAjaxResponse {
  name: string;
  note: string;
  is_active: boolean;
  create_todo: boolean;
  start_at: string | null;
  schedule_type: string;
  trigger_time: string;
  days_of_week: number[] | null;
  days_of_month: number[] | null;
}

function localDatetimeFromIso(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function EditReminderModal({ open, reminder, onClose, onSaved }: EditReminderModalProps) {
  const [state, setState] = useState<ReminderFormState>(DEFAULT_FORM_STATE);
  const [errors, setErrors] = useState<ReminderFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !reminder) return;
    let cancelled = false;
    setErrors({});
    setSubmitting(false);
    setLoading(true);
    axios
      .get<FormAjaxResponse>(reminder.form_ajax_url, { withCredentials: true })
      .then(response => {
        if (cancelled) return;
        const data = response.data;
        setState({
          name: data.name ?? "",
          note: data.note ?? "",
          is_active: data.is_active ?? true,
          create_todo: data.create_todo ?? false,
          schedule_type: data.schedule_type ?? "daily",
          trigger_time: data.trigger_time ?? "09:00",
          days_of_week: data.days_of_week ?? [],
          days_of_month: data.days_of_month ?? [],
          start_at: localDatetimeFromIso(data.start_at),
        });
        const t = window.setTimeout(() => nameRef.current?.focus(), 40);
        return () => window.clearTimeout(t);
      })
      .catch(() => {
        if (cancelled) return;
        setErrors({ non_field_errors: ["Could not load reminder."] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, reminder]);

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
    if (!state.name.trim()) {
      setErrors({ name: ["Name is required."] });
      return;
    }
    setSubmitting(true);
    const result = await submitReminderForm(reminder.update_url, state);
    setSubmitting(false);
    if (result.success) {
      onSaved();
      onClose();
    } else {
      setErrors(result.errors ?? { non_field_errors: [result.message ?? "Failed to save."] });
    }
  };

  if (!open || !reminder) return null;

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        className="refined-modal rm-form-modal"
        role="dialog"
        aria-label="edit reminder"
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Edit reminder</h2>

        {loading ? (
          <p className="refined-modal-lead">Loading…</p>
        ) : (
          <ReminderFormBody
            idPrefix="rm-edit"
            state={state}
            errors={errors}
            onChange={setState}
            nameRef={nameRef}
            onSubmitOnEnter={submit}
          />
        )}

        <div className="refined-modal-actions compact">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button
            type="submit"
            className="refined-btn primary"
            disabled={submitting || loading || !state.name.trim()}
          >
            {submitting ? "saving…" : "save"}
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}

export default EditReminderModal;
