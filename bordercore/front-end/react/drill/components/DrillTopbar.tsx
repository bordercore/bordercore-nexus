import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleNodes,
  faHeart,
  faCube,
  faComment,
  faPenToSquare,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";

interface DrillTopbarProps {
  isFavorite: boolean;
  onFavoriteToggle: () => void;
  onAskChatbot: () => void;
  onOpenObjectSelectModal: () => void;
  addQuestionUrl: string;
  editUrl: string;
  homeUrl: string;
  drillListUrl: string;
  studySession: { type: string; tag?: string; list: string[] } | null;
  studySessionProgress: number;
}

export function DrillTopbar({
  isFavorite,
  onFavoriteToggle,
  onAskChatbot,
  onOpenObjectSelectModal,
  addQuestionUrl,
  editUrl,
  homeUrl,
  drillListUrl,
  studySession,
  studySessionProgress,
}: DrillTopbarProps) {
  const sessionTotal = studySession?.list.length ?? 0;
  const sessionIndex = Math.min(studySessionProgress + 1, sessionTotal);
  const isTagStudy = studySession?.type === "tag";
  const pct = sessionTotal > 0 ? (sessionIndex / sessionTotal) * 100 : 0;

  return (
    <div className="drill-topbar">
      <div className="drill-brand-mark">
        <FontAwesomeIcon icon={faCircleNodes} />
      </div>

      <div className="drill-path">
        <a href={homeUrl} className="drill-path-link">
          bordercore
        </a>
        <span className="slash">/</span>
        <a href={drillListUrl} className="drill-path-link">
          drill
        </a>
        <span className="slash">/</span>
        {isTagStudy ? (
          <>
            <span>tag</span>
            <span className="slash">/</span>
            <span className="leaf">{studySession?.tag ?? ""}</span>
          </>
        ) : studySession ? (
          <span className="leaf">review</span>
        ) : (
          <span className="leaf">question</span>
        )}
      </div>

      {studySession && (
        <div className="drill-progress-pill">
          {isTagStudy && (
            <>
              <span className="pill-studying">studying</span>
              <span className="tag-chip pill-tag-chip">{studySession.tag}</span>
            </>
          )}
          <span>
            <span className="num">{sessionIndex}</span> <span className="of">of</span>{" "}
            <span className="total">{sessionTotal}</span>
          </span>
          <div className="drill-progress-track">
            {/* must remain inline */}
            <div className="drill-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          {!isTagStudy && <span className="pill-completed">questions completed</span>}
        </div>
      )}

      <div className="drill-topbar-right">
        <button
          className={`drill-icon-btn ${isFavorite ? "fav-on" : ""}`}
          title={isFavorite ? "Remove favorite" : "Add favorite"}
          aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
          onClick={onFavoriteToggle}
          type="button"
        >
          <FontAwesomeIcon icon={faHeart} />
        </button>
        <button
          className="drill-icon-btn"
          title="Related objects"
          aria-label="Related objects"
          onClick={onOpenObjectSelectModal}
          type="button"
        >
          <FontAwesomeIcon icon={faCube} />
        </button>
        <button
          className="drill-icon-btn"
          title="Discuss"
          aria-label="Discuss"
          onClick={onAskChatbot}
          type="button"
        >
          <FontAwesomeIcon icon={faComment} />
        </button>
        <a
          className="drill-icon-btn"
          href={editUrl}
          title="Edit question"
          aria-label="Edit question"
        >
          <FontAwesomeIcon icon={faPenToSquare} />
        </a>
        <a
          className="drill-icon-btn"
          href={addQuestionUrl}
          title="New question"
          aria-label="New question"
        >
          <FontAwesomeIcon icon={faPlus} />
        </a>
      </div>
    </div>
  );
}

export default DrillTopbar;
