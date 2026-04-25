import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClockRotateLeft } from "@fortawesome/free-solid-svg-icons";

interface ReviewStatePanelProps {
  lastReviewed: string | null;
  lastResponse: string | null;
  intervalDays: number;
  intervalIndex: number;
  intervalCount: number;
  timesFailed: number;
  needsReview: boolean;
  created: string;
}

const responseClass: Record<string, string> = {
  good: "ok",
  easy: "ok",
  hard: "warn",
  reset: "warn",
};

export function ReviewStatePanel({
  lastReviewed,
  lastResponse,
  intervalDays,
  intervalIndex,
  intervalCount,
  timesFailed,
  needsReview,
  created,
}: ReviewStatePanelProps) {
  const statusClass = needsReview ? "warn" : "ok";

  return (
    <div className="dpanel">
      <div className="dpanel-head">
        <h3>
          <FontAwesomeIcon icon={faClockRotateLeft} />
          Review State
        </h3>
        <span
          className={`status-dot ${statusClass}`}
          title={needsReview ? "needs review" : "up to date"}
          aria-label={needsReview ? "needs review" : "up to date"}
        />
      </div>
      <div className="meta-row">
        <span className="k">last reviewed</span>
        <span className="v">{lastReviewed ?? "never"}</span>
      </div>
      <div className="meta-row">
        <span className="k">last response</span>
        <span className={`v ${lastResponse ? (responseClass[lastResponse] ?? "") : ""}`}>
          {lastResponse ?? "—"}
        </span>
      </div>
      <div className="meta-row">
        <span className="k">interval</span>
        <span className="v accent">
          {intervalDays} day{intervalDays === 1 ? "" : "s"}
        </span>
      </div>
      <div className="meta-row">
        <span className="k">interval idx</span>
        <span className="v">
          {intervalIndex + 1} / {intervalCount}
        </span>
      </div>
      <div className="meta-row">
        <span className="k">times failed</span>
        <span className="v">{timesFailed}</span>
      </div>
      <div className="meta-row">
        <span className="k">needs review</span>
        <span className={`v ${needsReview ? "warn" : "ok"}`}>{needsReview ? "yes" : "no"}</span>
      </div>
      <div className="meta-row">
        <span className="k">created</span>
        <span className="v">{created}</span>
      </div>
    </div>
  );
}

export default ReviewStatePanel;
