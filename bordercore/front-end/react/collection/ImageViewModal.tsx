import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";

interface ImageViewModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string | null;
  alt?: string;
}

export function ImageViewModal({ open, onClose, imageUrl, alt }: ImageViewModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !imageUrl) return null;

  return createPortal(
    <>
      <div className="refined-modal-scrim refined-modal-scrim--viewer" onClick={onClose} />
      <div className="refined-modal refined-modal--viewer" role="dialog" aria-label="image preview">
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>
        <img src={imageUrl} alt={alt ?? ""} />
      </div>
    </>,
    document.body
  );
}

export default ImageViewModal;
