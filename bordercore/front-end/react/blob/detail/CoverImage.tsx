import React, { useState, useEffect, useRef } from "react";

// Retry schedule (ms) for re-attempting a cover that 404s while the thumbnail
// Lambda is still generating it. Intervals are the gap after each failed load;
// they sum to ~62s, comfortably past typical Lambda latency.
const COVER_RETRY_INTERVALS = [1500, 2500, 4000, 6000, 8000, 8000, 8000, 8000, 8000, 8000];

interface CoverImageProps {
  src: string;
  alt: string;
  // True when the cover is generated asynchronously (PDFs): it may 404 at first
  // and should show the "generating" placeholder while we retry. False for plain
  // images, whose coverUrl points at the already-uploaded file.
  pending: boolean;
  isClickable?: boolean;
  onClick?: () => void;
}

export function CoverImage({ src, alt, pending, isClickable = false, onClick }: CoverImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  // Append a cache-buster on retries so CloudFront re-fetches the object instead
  // of serving the cached 404 from the first attempt.
  const imgSrc = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}_cb=${attempt}`;

  const handleError = () => {
    // Plain images: behave like an ordinary <img> (no retry, no placeholder).
    if (!pending) return;
    if (attempt >= COVER_RETRY_INTERVALS.length) {
      setExhausted(true);
      return;
    }
    const delay = COVER_RETRY_INTERVALS[attempt];
    timerRef.current = window.setTimeout(() => setAttempt(a => a + 1), delay);
  };

  const showSkeleton = pending && !loaded;

  return (
    <>
      <img
        className={`bd-cover-img${showSkeleton ? " is-hidden" : ""}`}
        src={imgSrc}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={handleError}
        onClick={isClickable ? onClick : undefined}
      />
      {showSkeleton && (
        <div className="bd-cover-skeleton" role="status" aria-live="polite">
          <div className="bd-cover-skeleton-shine" />
          <div className="bd-cover-skeleton-caption">
            {exhausted ? "Still generating preview…" : "Generating preview…"}
          </div>
        </div>
      )}
    </>
  );
}

export default CoverImage;
