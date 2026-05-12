import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faTrashCan } from "@fortawesome/free-solid-svg-icons";
import { getCsrfToken } from "../utils/reactUtils";

interface DeleteCollectionModalProps {
  open: boolean;
  onClose: () => void;
  deleteUrl: string;
  collectionName: string;
}

export function DeleteCollectionModal({
  open,
  onClose,
  deleteUrl,
  collectionName,
}: DeleteCollectionModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the cancel button on open and close on Escape.
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = () => {
    formRef.current?.submit();
  };

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <div className="refined-modal" role="dialog" aria-label="confirm delete collection">
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Delete this collection?</h2>

        <p className="refined-modal-lead">
          <strong>{collectionName || "This collection"}</strong> will be permanently removed. This
          cannot be undone.
        </p>

        <form ref={formRef} action={deleteUrl} method="post" className="hidden">
          <input type="hidden" name="csrfmiddlewaretoken" defaultValue={getCsrfToken()} />
        </form>

        <div className="refined-modal-actions compact">
          <button ref={cancelRef} type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="button" className="refined-btn danger" onClick={handleConfirm}>
            <FontAwesomeIcon icon={faTrashCan} className="refined-btn-icon" />
            delete
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

export default DeleteCollectionModal;
