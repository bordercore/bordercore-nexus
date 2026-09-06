import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faArrowsRotate,
  faCircleInfo,
  faCloudArrowUp,
} from "@fortawesome/free-solid-svg-icons";
import { extractImageUrl, fetchImageAsFile } from "../../common/imageFile";

type PreviewMode = "video" | "book" | "image" | "note" | "create";

interface PreviewHeroProps {
  mode: PreviewMode;
  coverUrl?: string;
  durationLabel?: string;
  noteContentPreview?: string;
  // video-only
  videoUrl?: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onVideoReadyChange?: (ready: boolean) => void;
  // book-only
  pageNumber?: number;
  totalPages?: number;
  onPageNumberChange?: (n: number) => void;
  onExtractCover?: () => void;
  // create-mode drop zone
  onFileSelected?: (file: File) => void;
  // local object URL for an image the user just picked in create mode
  selectedFileUrl?: string | null;
}

export function PreviewHero({
  mode,
  coverUrl,
  durationLabel,
  noteContentPreview,
  videoUrl,
  videoRef,
  onVideoReadyChange,
  pageNumber,
  totalPages,
  onPageNumberChange,
  onExtractCover,
  onFileSelected,
  selectedFileUrl,
}: PreviewHeroProps) {
  const [dragOver, setDragOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const captureVideoUrl = useMemo(() => {
    if (!videoUrl) return undefined;
    // Ordinary playback may have cached this file without CORS headers.
    // Use a distinct URL for the CORS-enabled player that captures frames.
    const url = new URL(videoUrl, window.location.href);
    url.searchParams.set("video-preview", "1");
    return url.href;
  }, [videoUrl]);

  useEffect(() => {
    if (!imageOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setImageOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [imageOpen]);

  if (mode === "create") {
    return (
      <>
        <div
          className={`be-preview-drop ${dragOver ? "drag-over" : ""} ${
            selectedFileUrl ? "has-preview" : ""
          }`}
          onDragOver={e => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={e => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            setDropError(null);
            if (!onFileSelected) return;

            const file = e.dataTransfer.files?.[0];
            if (file) {
              onFileSelected(file);
              return;
            }

            // An image dragged from another browser tab arrives as a URL, not a
            // File. Recover the URL and fetch it into a File so it flows through
            // the same path.
            const url = extractImageUrl(e.dataTransfer);
            if (!url) return;

            void fetchImageAsFile(url).then(fetched => {
              if (fetched) {
                onFileSelected(fetched);
              } else {
                // The image host sent no Access-Control-Allow-Origin, so the
                // page can't read it. Say so rather than ignoring the drop.
                setDropError(
                  "Couldn't load that image. Drag a file from your computer, or download the image first."
                );
              }
            });
          }}
        >
          {selectedFileUrl ? (
            <>
              <img className="be-preview-drop-image" src={selectedFileUrl} alt="selected" />
              <label className="be-preview-drop-replace">
                replace
                <input
                  type="file"
                  hidden
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file && onFileSelected) onFileSelected(file);
                  }}
                />
              </label>
            </>
          ) : (
            <div>
              <FontAwesomeIcon icon={faCloudArrowUp} />
              <div>drag a file here</div>
              <label>
                choose file
                <input
                  type="file"
                  hidden
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file && onFileSelected) onFileSelected(file);
                  }}
                />
              </label>
            </div>
          )}
        </div>
        {dropError && <div className="be-preview-drop-error">{dropError}</div>}
      </>
    );
  }

  if (mode === "note") {
    return (
      <div className="be-preview">
        <div className="be-preview-note">
          <span className="corner">note · markdown</span>
          {noteContentPreview || "# Notes …"}
        </div>
      </div>
    );
  }

  if (mode === "video") {
    return (
      <div className="be-preview">
        <div className={`be-preview-media video ${videoPlaying ? "playing" : ""}`}>
          {videoPlaying && videoUrl ? (
            <video
              ref={videoRef}
              crossOrigin="anonymous"
              src={captureVideoUrl}
              poster={coverUrl}
              controls
              autoPlay
              onLoadedData={() => onVideoReadyChange?.(true)}
              onSeeking={() => onVideoReadyChange?.(false)}
              onSeeked={e => onVideoReadyChange?.(e.currentTarget.readyState >= 2)}
              onEmptied={() => onVideoReadyChange?.(false)}
              onError={() => onVideoReadyChange?.(false)}
            />
          ) : (
            <>
              {coverUrl && <img src={coverUrl} alt="cover" />}
              <button
                type="button"
                className="play-overlay"
                onClick={() => setVideoPlaying(true)}
                disabled={!videoUrl}
                aria-label="Play video"
              >
                <FontAwesomeIcon icon={faPlay} />
              </button>
              {durationLabel && <div className="duration-pill">{durationLabel}</div>}
            </>
          )}
        </div>
      </div>
    );
  }

  if (mode === "book") {
    return (
      <div className="be-preview">
        <div className="be-preview-book">
          <div className="be-preview-book-cover">
            {coverUrl && <img src={coverUrl} alt="cover" />}
            {pageNumber != null && <span className="page-badge">p. {pageNumber}</span>}
          </div>
          <div className="be-preview-book-body">
            <div className="row">
              <span>cover image</span>
              <span className="right">extracted from PDF</span>
            </div>
            <div className="be-stepper">
              <span className="label">page</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageNumber ?? 1}
                onChange={e => onPageNumberChange?.(Number(e.target.value))}
              />
              <span className="total">/ {totalPages ?? "?"}</span>
              <button type="button" className="extract" onClick={() => onExtractCover?.()}>
                <FontAwesomeIcon icon={faArrowsRotate} /> extract
              </button>
            </div>
            <div className="be-preview-book-hint">
              <FontAwesomeIcon icon={faCircleInfo} /> takes a few seconds to refresh
            </div>
          </div>
        </div>
      </div>
    );
  }

  // image (default)
  return (
    <>
      <div className="be-preview">
        <button
          type="button"
          className="be-preview-media image"
          onClick={() => coverUrl && setImageOpen(true)}
          disabled={!coverUrl}
          aria-label="View full image"
        >
          {coverUrl && <img src={coverUrl} alt="cover" />}
        </button>
      </div>
      {imageOpen && coverUrl && (
        <>
          <div className="be-image-lightbox-backdrop" onClick={() => setImageOpen(false)} />
          <div
            className="be-image-lightbox"
            onClick={() => setImageOpen(false)}
            role="dialog"
            aria-label="Image preview"
          >
            <img src={coverUrl} alt="full preview" />
          </div>
        </>
      )}
    </>
  );
}

export default PreviewHero;
