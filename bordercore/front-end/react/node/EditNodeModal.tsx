import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faCheck } from "@fortawesome/free-solid-svg-icons";

interface EditNodeModalProps {
  open: boolean;
  initialName: string;
  initialNote: string;
  onClose: () => void;
  onSave: (name: string, note: string) => void;
}

export function EditNodeModal({
  open,
  initialName,
  initialNote,
  onClose,
  onSave,
}: EditNodeModalProps) {
  const [name, setName] = useState(initialName);
  const [note, setNote] = useState(initialNote);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setNote(initialNote);
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, initialName, initialNote]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSave(name.trim(), note);
  };

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <div className="refined-modal" role="dialog" aria-label="edit node">
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <div className="refined-modal-eyebrow">
          <span>edit node</span>
          <span className="dot">·</span>
          <span className="mono">bordercore / nodes / edit</span>
        </div>

        <h2 className="refined-modal-title">Edit this node</h2>
        <p className="refined-modal-lead">
          rename the node and update its freeform note. components are unaffected.
        </p>

        <div className="refined-field">
          <label htmlFor="id_edit_name">name</label>
          <input
            ref={inputRef}
            id="id_edit_name"
            name="name"
            type="text"
            autoComplete="off"
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
          <label htmlFor="id_edit_note">
            note <span className="optional">· optional</span>
          </label>
          <textarea
            id="id_edit_note"
            name="note"
            placeholder="freeform description — markdown supported"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        <div className="refined-modal-actions">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button
            type="button"
            className="refined-btn primary"
            onClick={submit}
            disabled={!canSubmit}
          >
            <FontAwesomeIcon icon={faCheck} className="refined-btn-icon" />
            save changes <span className="kbd">⏎</span>
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

export default EditNodeModal;
