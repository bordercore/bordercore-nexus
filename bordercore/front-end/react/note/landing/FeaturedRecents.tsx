import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faThumbtack } from "@fortawesome/free-solid-svg-icons";
import { tagSwatchColor } from "../../utils/tagColors";
import { formatRelative } from "../../utils/formatRelative";
import { ImportanceDots } from "./ImportanceDots";
import type { NoteSummary } from "./types";

interface FeaturedRecentsProps {
  notes: NoteSummary[];
  totalRecents: number;
}

export function FeaturedRecents({ notes, totalRecents }: FeaturedRecentsProps) {
  return (
    <section className="nl-featured">
      <header className="nl-section-head">
        <h2 className="nl-section-title">Recently edited</h2>
        <span className="nl-section-meta">{totalRecents} total</span>
      </header>
      <div className="nl-featured-grid">
        {notes.map(note => {
          const visibleTags = note.tags.slice(0, 3);
          return (
            <a key={note.uuid} href={note.url} className="nl-card">
              <div className="nl-card-top">
                <span className="nl-card-time">{formatRelative(note.modified_iso)}</span>
                {note.is_pinned && (
                  <span className="nl-card-pin" aria-label="Pinned">
                    <FontAwesomeIcon icon={faThumbtack} />
                  </span>
                )}
              </div>
              <h3 className="nl-card-title">{note.name || "untitled"}</h3>
              <p className="nl-card-preview">{note.preview || "No preview available."}</p>
              <div className="nl-card-foot">
                <div className="nl-card-tags">
                  {visibleTags.map(tag => (
                    <span key={tag} className="nl-card-tag">
                      <span
                        className="nl-tag-dot"
                        // must remain inline (per-tag color from runtime hash)
                        style={{ background: tagSwatchColor(tag) }}
                        aria-hidden="true"
                      />
                      {tag}
                    </span>
                  ))}
                </div>
                <ImportanceDots importance={note.importance} />
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export default FeaturedRecents;
