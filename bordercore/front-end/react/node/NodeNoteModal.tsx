import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faCheck } from "@fortawesome/free-solid-svg-icons";
import { NODE_COLORS, type NodeColor } from "./types";

interface NoteData {
  name: string;
  color: NodeColor;
}

interface NodeNoteModalProps {
  open: boolean;
  action: "Add" | "Edit";
  data: NoteData | null;
  onSave: (data: NoteData) => void;
  onColorChange?: (color: NodeColor) => void;
  onClose: () => void;
}

export default function NodeNoteModal({
  open,
  action,
  data,
  onSave,
  onColorChange,
  onClose,
}: NodeNoteModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<NodeColor>(1);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(data?.name ?? "");
    setColor(data?.color ?? 1);
    const t = window.setTimeout(() => nameInputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, data]);

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
    onSave({ name, color });
  }, [canSubmit, name, color, onSave]);

  const getColorClass = (c: NodeColor) => {
    const selected = c === color ? "selected-color" : "";
    return `node-color node-color-${c} ${selected}`;
  };

  if (!open) return null;

  const title = action === "Edit" ? "Edit note" : "Add a note";

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        className="refined-modal"
        role="dialog"
        aria-label={title.toLowerCase()}
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">{title}</h2>

        <div className="refined-field">
          <label htmlFor="id_name_note">name</label>
          <input
            ref={nameInputRef}
            id="id_name_note"
            type="text"
            autoComplete="off"
            maxLength={200}
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
          <label htmlFor="id_color_note">color</label>
          <div id="id_color_note" className="d-flex">
            {NODE_COLORS.map(c => (
              <div
                key={c}
                className={`${getColorClass(c)} flex-grow-1 mx-2 cursor-pointer`}
                onClick={() => {
                  setColor(c);
                  onColorChange?.(c);
                }}
              />
            ))}
          </div>
        </div>

        <div className="refined-modal-actions compact">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="submit" className="refined-btn primary" disabled={!canSubmit}>
            <FontAwesomeIcon icon={faCheck} className="refined-btn-icon" />
            save
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}
