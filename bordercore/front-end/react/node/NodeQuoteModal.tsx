import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import {
  NODE_COLORS,
  ROTATE_OPTIONS,
  FORMAT_OPTIONS,
  type NodeColor,
  type QuoteOptions,
} from "./types";

interface NodeQuoteModalProps {
  isOpen: boolean;
  action: "Add" | "Edit";
  nodeUuid: string;
  addQuoteUrl: string;
  data: QuoteOptions | null;
  onSave: (options: QuoteOptions) => void;
  onAddQuote: (options: QuoteOptions) => void;
  onClose: () => void;
}

const defaultOptions: QuoteOptions = {
  color: 1,
  rotate: -1,
  format: "standard",
  favorites_only: false,
};

export default function NodeQuoteModal({
  isOpen,
  action,
  data,
  onSave,
  onAddQuote,
  onClose,
}: NodeQuoteModalProps) {
  const [options, setOptions] = useState<QuoteOptions>(defaultOptions);

  const rotateRef = useRef<HTMLSelectElement>(null);

  // Reset state every time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setOptions(data || defaultOptions);
    const t = window.setTimeout(() => {
      rotateRef.current?.focus();
    }, 40);
    return () => window.clearTimeout(t);
  }, [isOpen, data]);

  // Escape-to-close.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const submit = useCallback(() => {
    if (action === "Add") {
      onAddQuote(options);
    } else {
      onSave(options);
    }
  }, [action, options, onAddQuote, onSave]);

  const getColorClass = (c: NodeColor) => {
    const selected = c === options.color ? "selected-color" : "";
    return `node-color node-color-${c} ${selected}`;
  };

  if (!isOpen) return null;

  const title = action === "Add" ? "Add a quote" : "Edit quote";

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
          <label>color</label>
          <div className="d-flex">
            {NODE_COLORS.map(c => (
              <div
                key={c}
                className={`${getColorClass(c)} flex-grow-1 mx-2 cursor-pointer`}
                onClick={() => setOptions(prev => ({ ...prev, color: c }))}
              />
            ))}
          </div>
        </div>

        <div className="refined-row-2">
          <div className="refined-field">
            <label htmlFor="inputRotate">rotate</label>
            <select
              ref={rotateRef}
              id="inputRotate"
              value={options.rotate}
              onChange={e =>
                setOptions(prev => ({
                  ...prev,
                  rotate: parseInt(e.target.value, 10),
                }))
              }
            >
              {ROTATE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.display}
                </option>
              ))}
            </select>
          </div>

          <div className="refined-field">
            <label htmlFor="inputFormat">format</label>
            <select
              id="inputFormat"
              value={options.format}
              onChange={e =>
                setOptions(prev => ({
                  ...prev,
                  format: e.target.value as "standard" | "minimal",
                }))
              }
            >
              {FORMAT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.display}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="refined-field">
          <div className="d-flex align-items-center">
            <input
              type="checkbox"
              id="favoritesOnly"
              checked={options.favorites_only}
              onChange={e =>
                setOptions(prev => ({
                  ...prev,
                  favorites_only: e.target.checked,
                }))
              }
            />
            <label className="ms-2 mb-0" htmlFor="favoritesOnly">
              Favorites Only
            </label>
          </div>
        </div>

        <div className="refined-modal-actions compact">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="submit" className="refined-btn primary">
            save
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}
