import React, { useEffect, useRef } from "react";
import { Modal } from "bootstrap";

interface NodeImageModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
}

export default function NodeImageModal({
  isOpen,
  imageUrl,
  onClose,
}: NodeImageModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const modalInstanceRef = useRef<Modal | null>(null);

  useEffect(() => {
    if (modalRef.current && !modalInstanceRef.current) {
      modalInstanceRef.current = new Modal(modalRef.current);

      // Listen for modal close events
      modalRef.current.addEventListener("hidden.bs.modal", () => {
        onClose();
      });
    }
  }, [onClose]);

  useEffect(() => {
    if (modalInstanceRef.current) {
      if (isOpen) {
        modalInstanceRef.current.show();
      } else {
        modalInstanceRef.current.hide();
      }
    }
  }, [isOpen]);

  return (
    <div
      ref={modalRef}
      className="modal fade"
      id="node-image-modal"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="nodeImageModalLabel"
    >
      <div className="modal-dialog modal-dialog-centered modal-fullscreen" role="document">
        <div className="modal-content">
          <div className="modal-body">
            <button
              type="button"
              className="btn-close position-absolute top-0 end-0 m-3"
              data-bs-dismiss="modal"
              aria-label="Close"
            />
            <div className="d-flex justify-content-center align-items-center h-100">
              <img src={imageUrl} className="mw-100 mh-100" alt="" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
