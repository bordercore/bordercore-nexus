import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImages, faTimes } from "@fortawesome/free-solid-svg-icons";
import { ToggleSwitch } from "../common/ToggleSwitch";
import type { ObjectTag, SlideShowConfig } from "./types";

interface SlideShowModalProps {
  open: boolean;
  onClose: () => void;
  objectTags: ObjectTag[];
  onStart: (config: SlideShowConfig) => void;
}

const slideShowOptions = [
  { value: "1", display: "Every minute" },
  { value: "5", display: "Every 5 minutes" },
  { value: "10", display: "Every 10 minutes" },
  { value: "30", display: "Every 30 minutes" },
  { value: "60", display: "Every hour" },
  { value: "1440", display: "Every day" },
];

export function SlideShowModal({ open, onClose, objectTags, onStart }: SlideShowModalProps) {
  const [type, setType] = useState<"manual" | "automatic">("manual");
  const [interval, setInterval] = useState("60");
  const [randomize, setRandomize] = useState(false);
  const [tag, setTag] = useState("");
  const startBtnRef = useRef<HTMLButtonElement>(null);

  // Reset transient state every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setTag("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    startBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = () => {
    onClose();
    onStart({ type, interval, randomize, tag });
  };

  const isAutomatic = type === "automatic";

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <div className="refined-modal" role="dialog" aria-label="start slide show">
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Start a slide show</h2>

        <div className="refined-field">
          <label>mode</label>
          <div className="cd-segmented" role="group" aria-label="Slide show mode">
            <button
              type="button"
              className={type === "manual" ? "refined-btn primary" : "refined-btn ghost"}
              onClick={() => setType("manual")}
            >
              manual
            </button>
            <button
              type="button"
              className={isAutomatic ? "refined-btn primary" : "refined-btn ghost"}
              onClick={() => setType("automatic")}
            >
              automatic
            </button>
          </div>
        </div>

        <div className="refined-row-2">
          <div className="refined-field">
            <label htmlFor="slideshow-interval">
              interval {!isAutomatic && <span className="optional">· automatic only</span>}
            </label>
            <select
              id="slideshow-interval"
              value={interval}
              onChange={e => setInterval(e.target.value)}
              disabled={!isAutomatic}
            >
              {slideShowOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.display}
                </option>
              ))}
            </select>
          </div>
          <div className="refined-field">
            <label htmlFor="slideshow-tag">
              tag <span className="optional">· optional</span>
            </label>
            <select id="slideshow-tag" value={tag} onChange={e => setTag(e.target.value)}>
              <option value="">All objects</option>
              {objectTags.map(t => (
                <option key={t.id} value={t.tag}>
                  {t.tag}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="refined-toggle-row">
          <label className="refined-toggle">
            <ToggleSwitch
              id="slideshow-randomize"
              name="randomize"
              checked={randomize}
              onChange={setRandomize}
              disabled={!isAutomatic}
            />
            <span>randomize</span>
          </label>
        </div>

        <div className="refined-modal-actions compact">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button
            ref={startBtnRef}
            type="button"
            className="refined-btn primary"
            onClick={handleConfirm}
          >
            <FontAwesomeIcon icon={faImages} className="refined-btn-icon" />
            start slide show
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

export default SlideShowModal;
