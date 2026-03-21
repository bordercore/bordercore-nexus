import React, { useRef, useImperativeHandle, forwardRef } from "react";
import { Modal } from "bootstrap";

export interface DeactivateHabitModalHandle {
  openModal: () => void;
}

interface DeactivateHabitModalProps {
  onConfirm: () => void;
}

export const DeactivateHabitModal = forwardRef<
  DeactivateHabitModalHandle,
  DeactivateHabitModalProps
>(function DeactivateHabitModal({ onConfirm }, ref) {
  const modalRef = useRef<HTMLDivElement>(null);
  const modalInstanceRef = useRef<Modal | null>(null);

  useImperativeHandle(ref, () => ({
    openModal: () => {
      if (modalRef.current) {
        modalInstanceRef.current = new Modal(modalRef.current);
        modalInstanceRef.current.show();
      }
    },
  }));

  function handleConfirm() {
    modalInstanceRef.current?.hide();
    onConfirm();
  }

  return (
    <div
      ref={modalRef}
      className="modal fade"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="deactivateHabitModalLabel"
    >
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title" id="deactivateHabitModalLabel">
              Mark Habit Inactive
            </h4>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            />
          </div>
          <div className="modal-body">
            <div>Are you sure you want to mark this habit as inactive?</div>
            <div className="mt-3">
              <button className="btn btn-primary" onClick={handleConfirm}>
                Confirm
              </button>
              <a href="#" data-bs-dismiss="modal" className="ms-3">
                Cancel
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default DeactivateHabitModal;
