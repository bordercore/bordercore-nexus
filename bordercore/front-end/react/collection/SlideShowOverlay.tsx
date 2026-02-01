import React, { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

interface SlideShowOverlayProps {
  isActive: boolean;
  imageUrl: string;
  contentType: "Image" | "Video";
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

export function SlideShowOverlay({
  isActive,
  imageUrl,
  contentType,
  onNext,
  onPrevious,
  onClose,
}: SlideShowOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive) return;

      switch (e.key) {
        case "ArrowRight":
          onNext();
          break;
        case "ArrowLeft":
          onPrevious();
          break;
        case "Escape":
          onClose();
          break;
      }
    },
    [isActive, onNext, onPrevious, onClose]
  );

  // Set up keyboard listeners
  useEffect(() => {
    if (isActive) {
      document.addEventListener("keydown", handleKeyDown);
      // Hide scrollbars
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore scrollbars
      document.body.style.overflow = "visible";
    };
  }, [isActive, handleKeyDown]);

  // Update video source when URL changes
  useEffect(() => {
    if (contentType === "Video" && videoRef.current) {
      videoRef.current.src = imageUrl;
      videoRef.current.load();
    }
  }, [imageUrl, contentType]);

  if (!isActive) {
    return null;
  }

  const overlayContent = (
    <div id="overlay" className="slideshow-overlay">
      {contentType === "Image" ? (
        <img
          className="slide-show cursor-pointer"
          src={imageUrl}
          alt="Slideshow"
          onClick={onNext}
        />
      ) : (
        <video ref={videoRef} className="slide-show" controls autoPlay muted>
          <source src={imageUrl} type="video/mp4" />
        </video>
      )}
    </div>
  );

  return createPortal(overlayContent, document.body);
}

export default SlideShowOverlay;
