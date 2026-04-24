import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBolt, faPlay, faPlus } from "@fortawesome/free-solid-svg-icons";
import type { SessionPayload, DrillUrls } from "../types";
import { pluralize } from "../utils";

interface Props {
  streak: number;
  session: SessionPayload | null;
  urls: DrillUrls;
  onStudy: () => void;
  onNewQuestion: () => void;
}

export default function ActionCard({ streak, session, urls, onStudy, onNewQuestion }: Props) {
  return (
    <section className="drill-card drill-hero-action">
      <div className="card-eyebrow">
        <h3>next session</h3>
        <span className="meta">
          streak · {streak} {pluralize("day", streak)}
        </span>
      </div>
      <p className="prompt">
        Click <span className="hl">Study</span> to start a session, or pick a tag from the list
        below to drill on a specific category.
      </p>
      <div className="cta-row">
        <button type="button" className="drill-btn-huge" onClick={onStudy}>
          <FontAwesomeIcon icon={faBolt} />
          <span>Study</span>
          <span className="kbd">⇧S</span>
        </button>
        {session && (
          <a className="drill-btn-secondary" href={urls.resume}>
            <FontAwesomeIcon icon={faPlay} className="i" />
            <span>Resume</span>
          </a>
        )}
      </div>
      {session && (
        <div className="drill-session-status">
          <span className="pulse" />
          <span>
            studying <span className="link">{session.scopeLabel}</span> · {session.completed} of{" "}
            {session.total} done
            {session.nextIn && (
              <>
                {" "}
                · next <span className="accent">{session.nextIn}</span>
              </>
            )}
          </span>
        </div>
      )}
      <div className="drill-newq">
        <button type="button" onClick={onNewQuestion}>
          <FontAwesomeIcon icon={faPlus} />
          <span>New question</span>
        </button>
        <span className="hint">⌘N</span>
      </div>
    </section>
  );
}
