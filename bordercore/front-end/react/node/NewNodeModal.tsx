import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faPlus } from "@fortawesome/free-solid-svg-icons";
import { getCsrfToken } from "../utils/reactUtils";

interface NewNodeModalProps {
  open: boolean;
  onClose: () => void;
  createUrl: string;
}

export function NewNodeModal({ open, onClose, createUrl }: NewNodeModalProps) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setNote("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  // The existing NodeCreateView handles CSRF + redirect on success. Native
  // form submission POSTs back to node:list and reloads — matches the page's
  // pre-redesign flow.
  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    formRef.current?.submit();
  };

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        ref={formRef}
        action={createUrl}
        method="post"
        className="refined-modal"
        role="dialog"
        aria-label="create new node"
        onSubmit={e => {
          const tokenInput = e.currentTarget.querySelector<HTMLInputElement>(
            'input[name="csrfmiddlewaretoken"]'
          );
          if (tokenInput) tokenInput.value = getCsrfToken();
        }}
      >
        <input type="hidden" name="csrfmiddlewaretoken" defaultValue={getCsrfToken()} />

        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Create a node</h2>
        <p className="refined-modal-lead">
          a node is a topic container. you can attach collections, notes, todos, and images after
          it's created.
        </p>

        <div className="refined-field">
          <label htmlFor="id_name">name</label>
          <input
            ref={inputRef}
            id="id_name"
            name="name"
            type="text"
            autoComplete="off"
            placeholder="e.g. distributed systems, 2026 reading list, home server"
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
          <label htmlFor="id_note">
            note <span className="optional">· optional</span>
          </label>
          <textarea
            id="id_note"
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
            <FontAwesomeIcon icon={faPlus} className="refined-btn-icon" />
            create node <span className="kbd">⏎</span>
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}

export default NewNodeModal;
