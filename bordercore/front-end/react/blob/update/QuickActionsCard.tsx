import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBroom,
  faFont,
  faClone,
  faDownload,
  faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";

interface QuickActionsCardProps {
  onCleanupFilename: () => void;
  onUppercaseFirst: () => void;
  cloneUrl?: string;
  downloadUrl?: string;
  onDelete?: () => void;
}

export function QuickActionsCard({
  onCleanupFilename,
  onUppercaseFirst,
  cloneUrl,
  downloadUrl,
  onDelete,
}: QuickActionsCardProps) {
  return (
    <div className="be-section">
      <div className="be-label">quick actions</div>
      <nav className="be-nav">
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
        {onDelete && (
          <button type="button" className="be-nav-item danger" onClick={onDelete}>
            <FontAwesomeIcon icon={faTrashAlt} className="icon" />
            <span>delete blob</span>
            <span />
          </button>
        )}
      </nav>
    </div>
  );
}

export default QuickActionsCard;
