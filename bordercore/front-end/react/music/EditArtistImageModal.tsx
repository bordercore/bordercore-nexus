import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";

interface EditArtistImageModalProps {
  open: boolean;
  onClose: () => void;
  artistUuid: string;
  updateArtistImageUrl: string;
  onImageUpdated?: () => void;
}

export function EditArtistImageModal({
  open,
  onClose,
  artistUuid,
  updateArtistImageUrl,
  onImageUpdated,
}: EditArtistImageModalProps) {
  const [imageFilename, setImageFilename] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filenameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setImageFilename("");
    setImageFile(null);
    setIsSubmitting(false);
    const t = window.setTimeout(() => fileInputRef.current?.focus(), 40);
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFilename(file.name);
      setImageFile(file);
    }
  };

  const submit = useCallback(async () => {
    if (isSubmitting || !imageFile) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("artist_uuid", artistUuid);
      formData.append("image", imageFile);

      await axios.post(updateArtistImageUrl, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
      });

      if (onImageUpdated) {
        onImageUpdated();
      } else {
        // Add cache buster to force image reload
        window.location.href = window.location.pathname + "?cache_buster=" + Date.now();
      }
      onClose();
    } catch (error) {
      console.error("Error updating artist image:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, imageFile, artistUuid, updateArtistImageUrl, onImageUpdated, onClose]);

  if (!open) return null;

  const canSubmit = !!imageFile && !isSubmitting;

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        className="refined-modal"
        role="dialog"
        aria-label="edit artist image"
        encType="multipart/form-data"
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Edit artist image</h2>

        <div className="refined-field">
          <label htmlFor="artist-edit-image">artist image</label>
          <div className="refined-file">
            <input
              ref={filenameRef}
              id="artist-edit-image"
              type="text"
              value={imageFilename}
              placeholder="no file selected"
              autoComplete="off"
              readOnly
            />
            <label className="refined-btn ghost refined-file-pick">
              Choose image
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={handleImageSelect}
              />
            </label>
          </div>
        </div>

        <div className="refined-modal-actions compact">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="submit" className="refined-btn primary" disabled={!canSubmit}>
            {isSubmitting ? "uploading…" : "save"}
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}

export default EditArtistImageModal;
