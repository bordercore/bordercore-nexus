import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faCheck,
  faLink,
  faNewspaper,
} from "@fortawesome/free-solid-svg-icons";
import type { Feed, FeedItem } from "./types";
import { feedHueClass, feedInitials } from "./utils/favicon";
import { formatRelativeShort } from "./utils/time";
import { markItemRead } from "./utils/api";

interface ItemReaderProps {
  feed: Feed | null;
  item: FeedItem | null;
  onMarkRead: (itemId: number, patch: Partial<FeedItem>) => void;
}

const DWELL_MS = 800;

export function ItemReader({ feed, item, onMarkRead }: ItemReaderProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!item || item.readAt !== null) return;
    const id = item.id;
    const timer = window.setTimeout(() => {
      const optimistic = new Date().toISOString();
      onMarkRead(id, { readAt: optimistic });
      markItemRead(id, readAt => onMarkRead(id, { readAt }));
    }, DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [item?.id, item?.readAt, onMarkRead]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(t);
  }, [copied]);

  const relatedItems = useMemo(() => {
    if (!feed || !item) return [];
    return feed.feedItems
      .filter(i => i.id !== item.id)
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 4);
  }, [feed, item]);

  if (!feed || !item) {
    return (
      <section className="tp-reader">
        <div className="tp-reader-empty">
          <div className="tp-reader-placeholder tp-reader-placeholder--empty">
            <FontAwesomeIcon icon={faNewspaper} className="tp-reader-placeholder-icon" />
            <p className="tp-reader-placeholder-title">Select an item to read</p>
          </div>
        </div>
      </section>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.link);
      setCopied(true);
    } catch {
      // clipboard write can fail in unusual permission contexts; silently ignore
    }
  };

  return (
    <section className="tp-reader">
      <header className="tp-reader-head">
        <div className="tp-reader-head-source">
          <span className={`tp-favicon tp-favicon--lg ${feedHueClass(feed)}`} aria-hidden>
            {feedInitials(feed.name)}
          </span>
          <div className="tp-reader-head-meta">
            <span className="tp-reader-head-name">{feed.name}</span>
            <span className="tp-reader-head-detail">
              {feed.homepage && <span>{feed.homepage}</span>}
              <span>{formatRelativeShort(item.pubDate)} ago</span>
            </span>
          </div>
        </div>
        <div className="tp-reader-head-actions">
          <a
            className="btn-icon"
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open original in new tab"
            title="Open original in new tab"
          >
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
          </a>
          <button
            type="button"
            className={`btn-icon${copied ? " btn-icon--ok" : ""}`}
            onClick={handleCopy}
            aria-label={copied ? "Link copied" : "Copy link"}
            title={copied ? "Link copied" : "Copy link"}
          >
            <FontAwesomeIcon icon={copied ? faCheck : faLink} />
          </button>
        </div>
      </header>

      <h1 className="tp-reader-title">{item.title}</h1>

      {item.thumbnailUrl && (
        <a className="tp-reader-thumb" href={item.link} target="_blank" rel="noopener noreferrer">
          <img src={item.thumbnailUrl} alt="" loading="lazy" />
        </a>
      )}

      <a className="tp-reader-link" href={item.link} target="_blank" rel="noopener noreferrer">
        {item.link}
      </a>

      {item.summary ? (
        <p className="tp-reader-summary">{item.summary}</p>
      ) : (
        <div className="tp-reader-placeholder">
          <FontAwesomeIcon icon={faNewspaper} className="tp-reader-placeholder-icon" />
          <p className="tp-reader-placeholder-title">no preview available</p>
          <p className="tp-reader-placeholder-note">
            this feed didn't include a summary · open original to read
          </p>
        </div>
      )}

      {relatedItems.length > 0 && (
        <div className="tp-reader-meta">
          <span className="bc-label">in this feed</span>
          <ul className="tp-related-list">
            {relatedItems.map(related => (
              <li key={related.id} className="tp-related-row">
                <span
                  className={`tp-bullet${related.readAt === null ? " tp-bullet--unread" : ""}`}
                  aria-hidden
                />
                <a
                  className="tp-related-title"
                  href={related.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {related.title}
                </a>
                <span className="tp-related-time">{formatRelativeShort(related.pubDate)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default ItemReader;
