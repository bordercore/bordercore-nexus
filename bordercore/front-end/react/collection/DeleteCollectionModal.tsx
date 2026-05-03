import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faTrashCan } from "@fortawesome/free-solid-svg-icons";
import { getCsrfToken } from "../utils/reactUtils";

export interface DeleteCollectionModalHandle {
  openModal: () => void;
}

interface DeleteCollectionModalProps {
  deleteUrl: string;
  collectionName: string;
}

export const DeleteCollectionModal = forwardRef<
  DeleteCollectionModalHandle,
  DeleteCollectionModalProps
>(function DeleteCollectionModal({ deleteUrl, collectionName }, ref) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useImperativeHandle(ref, () => ({
    openModal: () => setOpen(true),
  }));

  // Focus the cancel button on open and close on Escape.
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const handleClose = () => setOpen(false);

  const handleConfirm = () => {
    formRef.current?.submit();
  };

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={handleClose} />
      <div className="refined-modal" role="dialog" aria-label="confirm delete collection">
        <button
          type="button"
          className="refined-modal-close"
          onClick={handleClose}
          aria-label="close"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <div className="refined-modal-eyebrow">
          <span>delete collection</span>
          <span className="dot">·</span>
          <span className="mono">bordercore / collection / delete</span>
        </div>

        <h2 className="refined-modal-title">Delete this collection?</h2>

        <p className="refined-modal-lead">
          <strong>{collectionName || "This collection"}</strong> will be permanently removed. This
          cannot be undone.
        </p>

        <form ref={formRef} action={deleteUrl} method="post" className="d-none">
          <input type="hidden" name="csrfmiddlewaretoken" defaultValue={getCsrfToken()} />
        </form>

        <div className="refined-modal-actions compact">
          <button ref={cancelRef} type="button" className="refined-btn ghost" onClick={handleClose}>
            cancel
          </button>
          <button type="button" className="refined-btn danger" onClick={handleConfirm}>
            <FontAwesomeIcon icon={faTrashCan} className="refined-btn-icon" />
            delete collection
          </button>
        </div>
      </div>
    </>,
    document.body
  );
});

export default DeleteCollectionModal;
