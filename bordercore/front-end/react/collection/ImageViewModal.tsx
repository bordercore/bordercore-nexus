import React, { useRef, useImperativeHandle, forwardRef, useCallback, useEffect } from "react";
import { Modal } from "bootstrap";

export interface ImageViewModalHandle {
  openModal: (imageUrl: string) => void;
  closeModal: () => void;
}

export const ImageViewModal = forwardRef<ImageViewModalHandle>(
  function ImageViewModal(_props, ref) {
    const [imageUrl, setImageUrl] = React.useState("");
    const modalRef = useRef<HTMLDivElement>(null);
    const modalInstanceRef = useRef<Modal | null>(null);

    const closeModal = useCallback(() => {
      if (modalInstanceRef.current) {
        modalInstanceRef.current.hide();
      }
    }, []);

    useImperativeHandle(ref, () => ({
      openModal: (url: string) => {
        setImageUrl(url);
        if (modalRef.current) {
          modalInstanceRef.current = new Modal(modalRef.current);
          modalInstanceRef.current.show();
        }
      },
      closeModal,
    }));

    // Handle escape key to close
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          closeModal();
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [closeModal]);

    return (
      <div
        ref={modalRef}
        className="modal fade"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="imageViewModal"
      >
        <div className="modal-dialog modal-xl modal-dialog-centered" role="document">
          <div className="modal-content bg-transparent border-0">
            <div className="modal-body text-center p-0">
              <button
                type="button"
                className="btn-close btn-close-white position-absolute top-0 end-0 m-3 image-view-modal-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Collection image"
                  className="img-fluid image-view-modal-image"
                  onClick={closeModal}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default ImageViewModal;
