import React, { useRef, useImperativeHandle, forwardRef } from "react";
import { Modal } from "bootstrap";

export interface DeleteCollectionModalHandle {
  openModal: () => void;
}

interface DeleteCollectionModalProps {
  deleteUrl: string;
  csrfToken: string;
}

export const DeleteCollectionModal = forwardRef<
  DeleteCollectionModalHandle,
  DeleteCollectionModalProps
>(function DeleteCollectionModal({ deleteUrl, csrfToken }, ref) {
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

  return (
    <div
      ref={modalRef}
      id="modalDelete"
      className="modal fade"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="deleteModalLabel"
    >
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <form action={deleteUrl} method="post">
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
            <div className="modal-header">
              <h4 className="modal-title" id="deleteModalLabel">
                Delete Collection
              </h4>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <div>Are you sure you want to delete this collection?</div>
              <div className="mt-3">
                <input className="btn btn-primary" type="submit" value="Confirm" />
                <a href="#" data-bs-dismiss="modal" className="ms-3">
                  Cancel
                </a>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});

export default DeleteCollectionModal;
