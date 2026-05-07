import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExchangeAlt } from "@fortawesome/free-solid-svg-icons";
import { doPost } from "../../utils/reactUtils";
import type { RelatedExercise } from "../types";

interface RelatedExercisesCardProps {
  related: RelatedExercise[];
  exerciseUuid: string;
  isActive: boolean;
  swapActiveExerciseUrl: string;
}

function formatLastActive(iso: string): string {
  if (!iso || iso === "Never") return "never";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  const days = Math.floor((Date.now() - then.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}

const GLYPHS = [
  <path
    key="up"
    d="M 4 20 L 12 14 L 20 16 L 28 6 L 34 10"
    stroke="var(--accent-4)"
    strokeWidth="1.5"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
  <path
    key="wave"
    d="M 4 14 Q 10 6 16 14 T 28 14 T 34 10"
    stroke="var(--ok)"
    strokeWidth="1.5"
    fill="none"
    strokeLinecap="round"
  />,
  <g key="bar">
    <rect x="4" y="14" width="4" height="8" fill="var(--accent)" />
    <rect x="12" y="9" width="4" height="13" fill="var(--accent)" opacity="0.7" />
    <rect x="20" y="6" width="4" height="16" fill="var(--accent)" opacity="0.9" />
    <rect x="28" y="11" width="4" height="11" fill="var(--accent)" opacity="0.5" />
  </g>,
  <g key="dots">
    <circle cx="8" cy="14" r="2.5" fill="var(--accent-3)" />
    <circle cx="18" cy="10" r="2.5" fill="var(--accent)" />
    <circle cx="28" cy="14" r="2.5" fill="var(--accent-4)" />
  </g>,
];

export function RelatedExercisesCard({
  related,
  exerciseUuid,
  isActive,
  swapActiveExerciseUrl,
}: RelatedExercisesCardProps) {
  const [pendingUuid, setPendingUuid] = useState<string | null>(null);

  function swapTo(item: RelatedExercise) {
    if (pendingUuid) return;
    setPendingUuid(item.uuid);
    doPost(
      swapActiveExerciseUrl,
      { from_uuid: exerciseUuid, to_uuid: item.uuid },
      response => {
        const toUrl = response.data?.to_url || item.exercise_url;
        if (toUrl) {
          window.location.href = toUrl;
        } else {
          setPendingUuid(null);
        }
      },
      "",
      "Error swapping exercise"
    );
    window.setTimeout(() => setPendingUuid(cur => (cur === item.uuid ? null : cur)), 4000);
  }

  return (
    <div className="ex-card">
      <h3>
        <span>related</span>
        <span className="ex-card-hint">same muscles</span>
      </h3>
      {related.length === 0 ? (
        <p className="ex-no-description">no related exercises</p>
      ) : (
        <div className="ex-related">
          {related.map((item, i) => {
            const busy = pendingUuid === item.uuid;
            return (
              <a key={item.uuid} href={item.exercise_url || "#"} className={busy ? "is-busy" : ""}>
                <div className="mini">
                  <svg viewBox="0 0 36 26" width="100%" height="100%">
                    {GLYPHS[i % GLYPHS.length]}
                  </svg>
                </div>
                <div className="info">
                  <div className="name">{item.name}</div>
                  <div className="when">last · {formatLastActive(item.last_active)}</div>
                </div>
                {isActive && (
                  <button
                    type="button"
                    className="ex-icon-btn ex-related-swap"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      swapTo(item);
                    }}
                    disabled={busy || pendingUuid !== null}
                    title={`swap active slot to ${item.name.toLowerCase()}`}
                    aria-label={`swap to ${item.name}`}
                  >
                    <FontAwesomeIcon icon={faExchangeAlt} />
                  </button>
                )}
                <span className="arrow">→</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
