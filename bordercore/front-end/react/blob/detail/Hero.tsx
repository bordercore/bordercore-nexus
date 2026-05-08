import React, { useCallback, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPencilAlt,
  faBolt,
  faLink,
  faEllipsisH,
  faClone,
  faDownload,
  faRedo,
  faThumbtack,
  faPlay,
  faCopy,
  faExpand,
} from "@fortawesome/free-solid-svg-icons";

import { doPost, EventBus } from "../../utils/reactUtils";
import { tagStyle } from "../../utils/tagColors";
import type { BlobDetail, BlobDetailUrls } from "../types";

interface HeroProps {
  blob: BlobDetail;
  urls: BlobDetailUrls;
  isPinnedNote: boolean;
  onPinToggle: () => void;
  onTitleSaved: (newName: string) => void;
  onEnterFullscreen: () => void;
}

export function Hero({
  blob,
  urls,
  isPinnedNote,
  onPinToggle,
  onTitleSaved,
  onEnterFullscreen,
}: HeroProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  const handleTitleBlur = useCallback(() => {
    const el = titleRef.current;
    if (!el) return;
    const newName = (el.innerText || "").trim();
    if (!newName || newName === blob.name) return;
    if (!urls.rename) return;

    doPost(
      urls.rename,
      { name: newName },
      response => {
        onTitleSaved(response.data?.name ?? newName);
        EventBus.$emit("toast", { body: "Saved" });
      },
      "",
      "Error renaming blob"
    );
  }, [blob.name, urls.rename, onTitleSaved]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    EventBus.$emit("toast", { body: "Link copied" });
  }, []);

  const handleCopySha1 = useCallback(() => {
    if (!blob.sha1sum) return;
    navigator.clipboard.writeText(blob.sha1sum);
    EventBus.$emit("toast", { body: "SHA1 copied to clipboard" });
  }, [blob.sha1sum]);

  const handlePlayAudio = useCallback(() => {
    if (!blob.fileUrl) return;
    const track = { uuid: blob.uuid, title: blob.name, musicSrc: blob.fileUrl };
    EventBus.$emit("play-track", {
      track,
      trackList: [track],
      songUrl: "",
      markListenedToUrl: "",
    });
  }, [blob.uuid, blob.name, blob.fileUrl]);

  return (
    <section className="bd-hero">
      <div className="bd-hero-body">
        <div className="bd-hero-eyebrow">
          <h1
            ref={titleRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={handleTitleBlur}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLElement).blur();
              }
            }}
          >
            {blob.name}
            {blob.editionString ? <span className="edition"> — {blob.editionString}</span> : null}
          </h1>
        </div>

        {blob.subtitle && <div className="bd-hero-subtitle">{blob.subtitle}</div>}

        {(blob.date || blob.author) && (
          <div className="bd-hero-meta">
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
          <div className="bd-hero-tags">
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

        <div className="bd-hero-actions">
          {blob.doctype && (
            <span className="doctype">
              <span className="dot" />
              {blob.doctype}
            </span>
          )}
          {blob.isAudio && blob.fileUrl && (
            <button type="button" className="bd-iconbtn primary" onClick={handlePlayAudio}>
              <FontAwesomeIcon icon={faPlay} /> play
            </button>
          )}
          <a className="bd-iconbtn" href={`${urls.create}?linked_blob_uuid=${blob.uuid}`}>
            <FontAwesomeIcon icon={faBolt} /> link new
          </a>
          <button type="button" className="bd-iconbtn ghost" onClick={handleCopyLink}>
            <FontAwesomeIcon icon={faLink} /> copy link
          </button>
          {blob.content && (
            <button type="button" className="bd-iconbtn ghost" onClick={onEnterFullscreen}>
              <FontAwesomeIcon icon={faExpand} /> fullscreen
            </button>
          )}
          <span className="bd-more-wrap">
            <button
              type="button"
              className="bd-iconbtn"
              onClick={() => setMoreOpen(o => !o)}
              aria-label="More actions"
            >
              <FontAwesomeIcon icon={faEllipsisH} />
            </button>
            {moreOpen && (
              <>
                <div className="bd-overlay-backdrop" onClick={() => setMoreOpen(false)} />
                <div className="bd-more-menu">
                  <a className="bd-more-item" href={urls.edit}>
                    <FontAwesomeIcon icon={faPencilAlt} /> Edit blob
                  </a>
                  <a className="bd-more-item" href={urls.clone}>
                    <FontAwesomeIcon icon={faClone} /> Clone blob
                  </a>
                  {blob.isNote && (
                    <button
                      type="button"
                      className="bd-more-item"
                      onClick={() => {
                        setMoreOpen(false);
                        onPinToggle();
                      }}
                    >
                      <FontAwesomeIcon icon={faThumbtack} />{" "}
                      {isPinnedNote ? "Unpin from home" : "Pin to home"}
                    </button>
                  )}
                  {blob.fileUrl && (
                    <a className="bd-more-item" href={blob.fileUrl}>
                      <FontAwesomeIcon icon={faDownload} /> Download source
                    </a>
                  )}
                  <button
                    type="button"
                    className="bd-more-item"
                    onClick={() => {
                      setMoreOpen(false);
                      EventBus.$emit("toast", { body: "Reindex requested" });
                    }}
                  >
                    <FontAwesomeIcon icon={faRedo} /> Reindex
                  </button>
                  {blob.sha1sum && (
                    <button
                      type="button"
                      className="bd-more-item"
                      onClick={() => {
                        setMoreOpen(false);
                        handleCopySha1();
                      }}
                    >
                      <FontAwesomeIcon icon={faCopy} /> Copy SHA1
                    </button>
                  )}
                </div>
              </>
            )}
          </span>
        </div>
      </div>
    </section>
  );
}

export default Hero;
