import React from "react";

interface BookCoverProps {
  /** Cover image URL from the Blob model. When the URL 404s, the placeholder shows through. */
  src?: string;
  /** Title used both as the alt-text and as the placeholder caption. */
  title: string;
}

/**
 * Cover thumbnail for a book row. Falls back to a purple→cyan gradient
 * panel with the title text when the cover image is missing or fails to
 * load (matches the BookCover placeholder in the design handoff).
 */
export function BookCover({ src, title }: BookCoverProps) {
  const [failed, setFailed] = React.useState(false);

  if (!src || failed) {
    return (
      <div className="bcc-cover bcc-cover--placeholder" aria-hidden="true">
        <span className="bcc-cover__title">{title}</span>
      </div>
    );
  }

  return (
    <div className="bcc-cover">
      <img src={src} alt={title || "Book cover"} loading="lazy" onError={() => setFailed(true)} />
    </div>
  );
}
