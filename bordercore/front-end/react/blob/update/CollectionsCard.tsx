import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolder, faCube, faQuestionCircle } from "@fortawesome/free-solid-svg-icons";

export interface CollectionItem {
  uuid?: string;
  name: string;
  num_objects: number;
  url?: string;
}

export interface BackrefItem {
  uuid?: string;
  type: "blob" | "question";
  name?: string;
  question?: string;
  url?: string;
}

interface CollectionsCardProps {
  collections: CollectionItem[];
  backrefs: BackrefItem[];
}

export function CollectionsCard({ collections, backrefs }: CollectionsCardProps) {
  if (collections.length === 0 && backrefs.length === 0) return null;

  return (
    <div className="be-section">
      {collections.length > 0 && (
        <>
          <div className="be-label">
            in {collections.length} {collections.length === 1 ? "collection" : "collections"}
          </div>
          <nav className="be-nav">
            {collections.map((c, i) => (
              <a
                key={c.uuid ?? `c-${i}`}
                className="be-nav-item"
                href={c.url ?? `/collection/${c.uuid}/`}
              >
                <FontAwesomeIcon icon={faFolder} className="icon be-nav-icon-folder" />
                <span>{c.name}</span>
                <span className="right">{c.num_objects}</span>
              </a>
            ))}
          </nav>
        </>
      )}

      {backrefs.length > 0 && (
        <>
          <div className={`be-label ${collections.length > 0 ? "spaced" : ""}`}>linked from</div>
          <nav className="be-nav">
            {backrefs.map((r, i) => {
              const label = r.type === "question" ? r.question || "(question)" : r.name || "(blob)";
              const icon = r.type === "blob" ? faCube : faQuestionCircle;
              const iconClass = r.type === "blob" ? "be-nav-icon-blob" : "be-nav-icon-question";
              return (
                <a
                  key={r.uuid ?? `r-${i}`}
                  className="be-nav-item"
                  href={r.url ?? (r.type === "blob" ? `/blob/${r.uuid}/` : `/drill/${r.uuid}/`)}
                >
                  <FontAwesomeIcon icon={icon} className={`icon ${iconClass}`} />
                  <span>{label}</span>
                  <span />
                </a>
              );
            })}
          </nav>
        </>
      )}
    </div>
  );
}

export default CollectionsCard;
