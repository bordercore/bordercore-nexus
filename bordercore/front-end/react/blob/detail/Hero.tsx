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
  faTrashAlt,
  faThumbtack,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";
import axios from "axios";

import { doPost, EventBus } from "../../utils/reactUtils";
import { tagStyle } from "../../utils/tagColors";
import type { BlobDetail, BlobDetailUrls } from "../types";

interface HeroProps {
  blob: BlobDetail;
  urls: BlobDetailUrls;
  isPinnedNote: boolean;
  onPinToggle: () => void;
  onTitleSaved: (newName: string) => void;
  onOpenDrawer: () => void;
}

export function Hero({
  blob,
  urls,
  isPinnedNote,
  onPinToggle,
  onTitleSaved,
  onOpenDrawer,
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

  const handleDelete = useCallback(() => {
    if (!confirm("Are you sure you want to delete this blob?")) return;
    axios
      .delete(urls.delete)
      .then(() => {
        window.location.href = urls.list;
      })
      .catch(error => {
        EventBus.$emit("toast", {
          title: "Error",
          body: `Error deleting blob: ${error}`,
          variant: "danger",
        });
      });
  }, [urls.delete, urls.list]);

  return (
    <section className="bd-hero">
      <div className="bd-hero-body">
        <div className="bd-hero-eyebrow">
          {blob.isNote && (
            <button
              type="button"
              className={`bd-pin-toggle${isPinnedNote ? " active" : ""}`}
              onClick={onPinToggle}
            >
              <FontAwesomeIcon icon={faThumbtack} />
              {isPinnedNote ? "pinned to home" : "pin to home"}
            </button>
          )}
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
          <button
            type="button"
            className="bd-iconbtn is-end"
            onClick={onOpenDrawer}
            aria-label="Open details drawer"
          >
            <FontAwesomeIcon icon={faInfoCircle} />
          </button>
        </div>

        {(blob.created || blob.modified || blob.author) && (
          <div className="bd-hero-meta">
            {blob.created && <span>{blob.created}</span>}
            {blob.modified && (
              <>
                <span className="sep">·</span>
                <span>last edited {blob.modified}</span>
              </>
            )}
            {blob.author && (
              <>
                <span className="sep">·</span>
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
          <a className="bd-iconbtn" href={`${urls.create}?linked_blob_uuid=${blob.uuid}`}>
            <FontAwesomeIcon icon={faBolt} /> link new
          </a>
          <button type="button" className="bd-iconbtn ghost" onClick={handleCopyLink}>
            <FontAwesomeIcon icon={faLink} /> copy link
          </button>
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
                  <div className="bd-more-sep" />
                  <button
                    type="button"
                    className="bd-more-item danger"
                    onClick={() => {
                      setMoreOpen(false);
                      handleDelete();
                    }}
                  >
                    <FontAwesomeIcon icon={faTrashAlt} /> Delete blob
                  </button>
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
