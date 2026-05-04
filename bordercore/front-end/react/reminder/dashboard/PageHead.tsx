import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

interface PageHeadProps {
  total: number;
  active: number;
  onNew: () => void;
}

export function PageHead({ total, active, onNew }: PageHeadProps) {
  return (
    <header className="rm-page-head">
      <div className="rm-page-head-text">
        <h1>
          Reminders{" "}
          <span className="rm-page-head-meta">
            / {total} total · {active} active
          </span>
        </h1>
        <p>
          Recurring nudges. The rail tracks what&apos;s next, what fires today, and the queue. Tap a
          row to view, edit, or remove.
        </p>
      </div>
      <button type="button" className="rm-new-btn" onClick={onNew}>
        <FontAwesomeIcon icon={faPlus} />
        New reminder
      </button>
    </header>
  );
}

export default PageHead;
