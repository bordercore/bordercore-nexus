import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faThumbtack } from "@fortawesome/free-solid-svg-icons";
import { tagSwatchColor } from "../../utils/tagColors";
import { formatRelative } from "../../utils/formatRelative";
import type { NoteSummary } from "./types";

interface MoreRecentProps {
  notes: NoteSummary[];
}

export function MoreRecent({ notes }: MoreRecentProps) {
  if (notes.length === 0) return null;

  return (
    <section className="nl-more">
      <header className="nl-strip-head">
        <span className="nl-strip-label">more recent</span>
      </header>
      <ul className="nl-more-list">
        {notes.map(note => {
          const visibleTags = note.tags.slice(0, 2);
          return (
            <li key={note.uuid} className="nl-more-row">
              <a href={note.url} className="nl-more-title">
                {note.is_pinned && (
                  <span className="nl-more-pin" aria-hidden="true">
                    <FontAwesomeIcon icon={faThumbtack} />
                  </span>
                )}
                {note.name || "untitled"}
              </a>
              <span className="nl-more-tags">
                {visibleTags.map(tag => (
                  <span
                    key={tag}
                    className="nl-tag-dot"
                    // must remain inline (per-tag color from runtime hash)
                    style={{ background: tagSwatchColor(tag) }}
                    title={tag}
                    aria-label={tag}
                  />
                ))}
              </span>
              <span className="nl-more-time">{formatRelative(note.modified_iso)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default MoreRecent;
