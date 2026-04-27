import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faMusic, faFileLines } from "@fortawesome/free-solid-svg-icons";

interface HeroThumbProps {
  doctype: string;
  name: string;
  coverUrl?: string;
  isImage?: boolean;
  isVideo?: boolean;
  isAudio?: boolean;
  isPdf?: boolean;
}

// Doctype-aware thumbnail. Prefers a real cover image when available; falls
// back to gradient/placeholder variants per the design handoff.
export function HeroThumb({
  doctype,
  name,
  coverUrl,
  isImage,
  isVideo,
  isAudio,
  isPdf,
}: HeroThumbProps) {
  const hasCover = !!coverUrl;

  if (isVideo) {
    return (
      <div className="bd-hero-thumb video">
        {hasCover ? <img src={coverUrl} alt={name} /> : null}
        <div className="play-overlay">
          <div className="pip">
            <FontAwesomeIcon icon={faPlay} />
          </div>
        </div>
      </div>
    );
  }

  if (isImage && hasCover) {
    return (
      <div className="bd-hero-thumb square">
        <img src={coverUrl} alt={name} />
      </div>
    );
  }

  if (isPdf || doctype === "book") {
    return (
      <div className="bd-hero-thumb tall">
        {hasCover ? (
          <img src={coverUrl} alt={name} />
        ) : (
          <div className="bd-hero-thumb-cover-fallback">
            <span className="bd-hero-thumb-cover-fallback-text">{name}</span>
          </div>
        )}
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="bd-hero-thumb square audio">
        <FontAwesomeIcon icon={faMusic} />
      </div>
    );
  }

  if (doctype === "note") {
    return (
      <div className="bd-hero-thumb note">
        <FontAwesomeIcon icon={faFileLines} />
      </div>
    );
  }

  return <div className="bd-hero-thumb empty">{doctype || "blob"}</div>;
}

export default HeroThumb;
