import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faPowerOff } from "@fortawesome/free-solid-svg-icons";

interface DeactivateHabitModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeactivateHabitModal({ open, onClose, onConfirm }: DeactivateHabitModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the safer (cancel) action when the modal opens.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 40);
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

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <div className="refined-modal" role="dialog" aria-label="confirm deactivate habit">
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Deactivate habit?</h2>
        <p className="refined-modal-lead">
          This habit will be marked inactive and stop appearing in your active list. You can still
          view its history.
        </p>

        <div className="refined-modal-actions compact">
          <button ref={cancelRef} type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="button" className="refined-btn danger" onClick={handleConfirm}>
            <FontAwesomeIcon icon={faPowerOff} className="refined-btn-icon" />
            deactivate
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

export default DeactivateHabitModal;
