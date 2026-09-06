import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBroom, faFont, faClone, faDownload, faCamera } from "@fortawesome/free-solid-svg-icons";

interface QuickActionsCardProps {
  onCleanupFilename: () => void;
  onUppercaseFirst: () => void;
  cloneUrl?: string;
  downloadUrl?: string;
  onCaptureFrame?: () => void;
  canCaptureFrame?: boolean;
  capturingFrame?: boolean;
}

export function QuickActionsCard({
  onCleanupFilename,
  onUppercaseFirst,
  cloneUrl,
  downloadUrl,
  onCaptureFrame,
  canCaptureFrame,
  capturingFrame,
}: QuickActionsCardProps) {
  return (
    <div className="be-section">
      <div className="be-label">quick actions</div>
      <nav className="be-nav">
        {onCaptureFrame && (
          <button
            type="button"
            className="be-nav-item"
            onClick={onCaptureFrame}
            disabled={!canCaptureFrame || capturingFrame}
            title="Play or seek the video to the desired frame, then capture it as the thumbnail."
          >
            <FontAwesomeIcon icon={faCamera} className="icon" />
            <span>{capturingFrame ? "saving thumbnail…" : "capture frame as thumbnail"}</span>
            <span />
          </button>
        )}
        <button type="button" className="be-nav-item" onClick={onCleanupFilename}>
          <FontAwesomeIcon icon={faBroom} className="icon" />
          <span>cleanup filename</span>
          <span />
        </button>
        <button type="button" className="be-nav-item" onClick={onUppercaseFirst}>
          <FontAwesomeIcon icon={faFont} className="icon" />
          <span>upper case first</span>
          <span />
        </button>
        {cloneUrl && (
          <a className="be-nav-item" href={cloneUrl}>
            <FontAwesomeIcon icon={faClone} className="icon" />
            <span>clone blob</span>
            <span />
          </a>
        )}
        {downloadUrl && (
          <a className="be-nav-item" href={downloadUrl} download>
            <FontAwesomeIcon icon={faDownload} className="icon" />
            <span>download file</span>
            <span />
          </a>
        )}
      </nav>
    </div>
  );
}

export default QuickActionsCard;
