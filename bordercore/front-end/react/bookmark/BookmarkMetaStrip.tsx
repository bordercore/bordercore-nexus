import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faTriangleExclamation,
  faXmark,
  faClock,
} from "@fortawesome/free-solid-svg-icons";
import { formatRelative } from "../utils/formatRelative";

interface BookmarkMetaStripProps {
  created: string;
  modified: string;
  lastCheck: string | null;
  lastResponseCode: number | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type ChipState = "ok" | "warn" | "broken" | "never";

function chipState(lastCheck: string | null, code: number | null): ChipState {
  if (!lastCheck || code === null) return "never";
  if (code >= 200 && code < 300) return "ok";
  if (code >= 300 && code < 400) return "warn";
  return "broken";
}

export function BookmarkMetaStrip({
  created,
  modified,
  lastCheck,
  lastResponseCode,
}: BookmarkMetaStripProps) {
  const state = chipState(lastCheck, lastResponseCode);
  const showModified = modified && modified !== created;

  let chipIcon = faClock;
  let chipText: string;
  if (state === "never") {
    chipText = "Never checked";
  } else if (state === "ok") {
    chipIcon = faCheck;
    chipText = `OK ${lastResponseCode} · ${formatRelative(lastCheck!)}`;
  } else if (state === "warn") {
    chipIcon = faTriangleExclamation;
    chipText = `Redirect ${lastResponseCode} · ${formatRelative(lastCheck!)}`;
  } else {
    chipIcon = faXmark;
    chipText = `Broken ${lastResponseCode} · ${formatRelative(lastCheck!)}`;
  }

  return (
    <div className="refined-meta-strip" aria-label="bookmark metadata">
      <span className="meta-item">
        <span className="meta-label">added</span>
        <span className="meta-value">{formatDate(created)}</span>
      </span>
      {showModified && (
        <span className="meta-item">
          <span className="meta-label">modified</span>
          <span className="meta-value">{formatDate(modified)}</span>
        </span>
      )}
      <span className={`refined-status-chip ${state}`} aria-label="last check status">
        <FontAwesomeIcon icon={chipIcon} />
        <span>{chipText}</span>
      </span>
    </div>
  );
}

export default BookmarkMetaStrip;
