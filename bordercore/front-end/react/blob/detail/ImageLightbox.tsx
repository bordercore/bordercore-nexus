import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

import { useBodyScrollLock } from "../../utils/useBodyScrollLock";

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  useBodyScrollLock();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const overlay = (
    <div
      className="bd-image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen image"
      onClick={onClose}
    >
      <button
        type="button"
        className="bd-image-lightbox-close"
        onClick={onClose}
        aria-label="Close fullscreen image"
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>
      <img
        className="bd-image-lightbox-img"
        src={src}
        alt={alt}
        onClick={e => e.stopPropagation()}
      />
    </div>
  );

  return createPortal(overlay, document.body);
}

export default ImageLightbox;
