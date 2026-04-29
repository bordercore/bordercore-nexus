import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faArrowsRotate,
  faCircleInfo,
  faCloudArrowUp,
} from "@fortawesome/free-solid-svg-icons";

type PreviewMode = "video" | "book" | "image" | "note" | "create";

interface PreviewHeroProps {
  mode: PreviewMode;
  coverUrl?: string;
  durationLabel?: string;
  noteContentPreview?: string;
  // video-only
  videoUrl?: string;
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
  pageNumber,
  totalPages,
  onPageNumberChange,
  onExtractCover,
  onFileSelected,
  selectedFileUrl,
}: PreviewHeroProps) {
  const [dragOver, setDragOver] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

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
          const file = e.dataTransfer.files?.[0];
          if (file && onFileSelected) onFileSelected(file);
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
            <video src={videoUrl} controls autoPlay />
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
