import React from "react";
import axios from "axios";
import { Modal } from "bootstrap";

interface EditArtistImageModalProps {
  artistUuid: string;
  updateArtistImageUrl: string;
  csrfToken: string;
  onImageUpdated?: () => void;
}

export interface EditArtistImageModalHandle {
  openModal: () => void;
}

export const EditArtistImageModal = React.forwardRef<EditArtistImageModalHandle, EditArtistImageModalProps>(
  function EditArtistImageModal(
    { artistUuid, updateArtistImageUrl, csrfToken, onImageUpdated },
    ref
  ) {
    const [imageFilename, setImageFilename] = React.useState("");
    const [imageFile, setImageFile] = React.useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const modalRef = React.useRef<HTMLDivElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const openModal = React.useCallback(() => {
      // Reset form
      setImageFilename("");
      setImageFile(null);

      if (modalRef.current) {
        const modal = new Modal(modalRef.current);
        modal.show();
      }
    }, []);

    // Expose openModal to parent via ref
    React.useImperativeHandle(ref, () => ({
      openModal,
    }));

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setImageFilename(file.name);
        setImageFile(file);
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmitting || !imageFile) return;

      setIsSubmitting(true);
      try {
        const formData = new FormData();
        formData.append("artist_uuid", artistUuid);
        formData.append("image", imageFile);

        await axios.post(updateArtistImageUrl, formData, {
          headers: {
            "X-CSRFToken": csrfToken,
            "Content-Type": "multipart/form-data",
          },
          withCredentials: true,
        });

        // Close modal and refresh image
        if (onImageUpdated) {
          onImageUpdated();
        } else {
          // Add cache buster to force image reload
          window.location.href = window.location.pathname + "?cache_buster=" + Date.now();
        }
      } catch (error) {
        console.error("Error updating artist image:", error);
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div
        ref={modalRef}
        id="modalEditArtistImage"
        className="modal fade"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="editArtistImageModalLabel"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <form onSubmit={handleSubmit} encType="multipart/form-data">
              <div className="modal-header">
                <h4 id="editArtistImageModalLabel" className="modal-title">
                  Edit Artist Image
                </h4>
                <button
                  type="button"
                  className="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                />
              </div>
              <div className="modal-body">
                <div className="row">
                  <label className="col-lg-4 col-form-label fw-bold text-end">
                    Artist Image
                  </label>
                  <div className="col-lg-8">
                    <div className="input-group">
                      <input
                        type="text"
                        className="form-control"
                        value={imageFilename}
                        readOnly
                        autoComplete="off"
                      />
                      <label className="btn btn-primary">
                        Choose image
                        <input
                          type="file"
                          ref={fileInputRef}
                          name="image"
                          hidden
                          accept="image/*"
                          onChange={handleImageSelect}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  id="btn-action"
                  className="btn btn-primary"
                  type="submit"
                  disabled={isSubmitting || !imageFile}
                >
                  {isSubmitting ? "Uploading..." : "Edit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
);

export default EditArtistImageModal;
