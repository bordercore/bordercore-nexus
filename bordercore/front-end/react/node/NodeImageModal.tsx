import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";

interface NodeImageModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
}

export default function NodeImageModal({ isOpen, imageUrl, onClose }: NodeImageModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="refined-modal-scrim refined-modal-scrim--viewer" onClick={onClose} />
      <div className="refined-modal refined-modal--viewer" role="dialog" aria-label="image preview">
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>
        <img src={imageUrl} alt="" />
      </div>
    </>,
    document.body
  );
}
