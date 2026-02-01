import React, { useState, useCallback, useRef, useEffect } from "react";
import { Modal } from "bootstrap";

interface BlobDetailCoverProps {
  coverUrl: string;
  fullSize?: boolean;
}

const RETRY_INTERVALS = [1000, 3000, 6000];

export function BlobDetailCover({ coverUrl, fullSize = true }: BlobDetailCoverProps) {
  const [currentUrl, setCurrentUrl] = useState(coverUrl);
  const [isHidden, setIsHidden] = useState(false);
  const attemptCount = useRef(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalInstance = useRef<Modal | null>(null);

  useEffect(() => {
    if (modalRef.current && !modalInstance.current) {
      modalInstance.current = new Modal(modalRef.current);
    }
  }, []);

  const handleImageError = useCallback(() => {
    if (attemptCount.current >= RETRY_INTERVALS.length) {
      return;
    }

    setIsHidden(true);

    setTimeout(() => {
      attemptCount.current++;
      console.log(`Retrieving cover image, attempt #${attemptCount.current}`);
      // Add cache-busting parameter
      setCurrentUrl(`${coverUrl}&nocache=${Date.now()}`);
      setIsHidden(false);
    }, RETRY_INTERVALS[attemptCount.current]);
  }, [coverUrl]);

  const handleImageClick = useCallback(() => {
    modalInstance.current?.show();
  }, []);

  const imageClass = fullSize ? "blob-detail-cover-image" : "blob-detail-cover-image-with-content";

  return (
    <div className={imageClass}>
      <img
        className={`cursor-pointer${isHidden ? " blob-detail-cover-img-hidden" : ""}`}
        src={currentUrl}
        onClick={handleImageClick}
        onError={handleImageError}
        alt=""
      />
      <div
        ref={modalRef}
        className="modal fade"
        tabIndex={-1}
        role="dialog"
        aria-label="Cover image modal"
      >
        <div className="modal-dialog modal-dialog-centered w-75 mw-100" role="document">
          <div className="modal-content">
            <div className="modal-body">
              <img className="w-100" src={currentUrl} alt="" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BlobDetailCover;
