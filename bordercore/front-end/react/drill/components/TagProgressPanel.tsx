import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTag } from "@fortawesome/free-solid-svg-icons";

interface TagProgressInfo {
  name: string;
  progress: number;
  count: number;
  last_reviewed: string;
  url: string;
}

interface TagProgressPanelProps {
  tags: TagProgressInfo[];
}

export function TagProgressPanel({ tags }: TagProgressPanelProps) {
  return (
    <div className="dpanel">
      <div className="dpanel-head">
        <h3>
          <FontAwesomeIcon icon={faTag} />
          Tag Progress
        </h3>
      </div>
      {tags.map(t => (
        <div className="tag-progress-row" key={t.name}>
          <div className="tag-progress-head">
            <a href={t.url} className="name tag-progress-name">
              {t.name}
            </a>
            <span className="pct">{t.progress}%</span>
          </div>
          <div className="tag-progress-bar">
            {/* must remain inline */}
            <div className="tag-progress-fill" style={{ width: `${t.progress}%` }} />
          </div>
          <div className="tag-progress-meta">
            <span>
              {t.count} question{t.count === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>{t.last_reviewed}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TagProgressPanel;
