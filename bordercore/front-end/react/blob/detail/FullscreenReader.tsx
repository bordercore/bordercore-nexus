import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import Prism from "prismjs";

import { tagStyle } from "../../utils/tagColors";
import type { BlobDetail } from "../types";

interface FullscreenReaderProps {
  blob: BlobDetail;
  // Pre-sanitized HTML produced by DOMPurify in BlobDetailPage. Same string is
  // mounted in the main view; we mount the same trusted output here.
  renderedContent: string;
  onClose: () => void;
}

export function FullscreenReader({ blob, renderedContent, onClose }: FullscreenReaderProps) {
  const contentRef = useRef<HTMLElement | null>(null);

  // Lock background scroll while the reader is open. Save and restore the
  // previous overflow value so we don't clobber any other consumer.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Close on Esc.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Re-run Prism over the freshly mounted DOM so code blocks pick up the same
  // syntax highlighting + copy-button treatment as the main page.
  useEffect(() => {
    if (!renderedContent) return;
    const root = contentRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("pre code").forEach(el => Prism.highlightElement(el));
  }, [renderedContent]);

  // Re-typeset MathJax inside the reader if the blob has math support enabled.
  useEffect(() => {
    if (!blob.mathSupport) return;
    const mathJax = (
      window as unknown as {
        MathJax?: { typesetPromise?: (els?: HTMLElement[]) => Promise<void> };
      }
    ).MathJax;
    if (!mathJax?.typesetPromise) return;
    const root = contentRef.current;
    if (!root) return;
    mathJax.typesetPromise([root]).catch((err: Error) => {
      console.error("MathJax typeset error:", err);
    });
  }, [blob.mathSupport, renderedContent]);

  const overlay = (
    <div
      className="bd-fullscreen-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen reader"
    >
      <div className="bd-page bd-fullscreen-reader-root">
        <button
          type="button"
          className="bd-fullscreen-close"
          onClick={onClose}
          aria-label="Close fullscreen reader"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>

        <article className="bd-fullscreen-reader">
          <header className="bd-fullscreen-header">
            <h1 className="bd-fullscreen-title">
              {blob.name}
              {blob.editionString && <span className="edition"> — {blob.editionString}</span>}
            </h1>

            {blob.subtitle && <div className="bd-fullscreen-subtitle">{blob.subtitle}</div>}

            {(blob.date || blob.author) && (
              <div className="bd-fullscreen-meta">
                {blob.date && <span>{blob.date}</span>}
                {blob.author && (
                  <>
                    {blob.date && <span className="sep">·</span>}
                    <span className="author">{blob.author}</span>
                  </>
                )}
              </div>
            )}

            {blob.tags.length > 0 && (
              <div className="bd-fullscreen-tags">
                {blob.tags.map(tag => (
                  <a
                    key={tag.name}
                    className="bd-tag"
                    href={tag.url}
                    // must remain inline
                    style={tagStyle(tag.name)}
                  >
                    #{tag.name}
                  </a>
                ))}
              </div>
            )}
          </header>

          {renderedContent ? (
            <article
              className="bd-content bd-fullscreen-content"
              ref={el => {
                contentRef.current = el;
              }}
              // renderedContent is already DOMPurify-sanitized in BlobDetailPage
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          ) : (
            <div className="bd-fullscreen-empty">No text content for this blob.</div>
          )}
        </article>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

export default FullscreenReader;
