import React, { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckDouble, faPencil, faTrash } from "@fortawesome/free-solid-svg-icons";
import type { Feed } from "./types";
import { feedHueClass, feedInitials } from "./utils/favicon";
import { formatRelativeShort } from "./utils/time";
import { markFeedRead } from "./utils/api";

interface ItemListProps {
  feed: Feed | null;
  activeItemId: number | null;
  onSelectItem: (itemId: number) => void;
  onMarkAllRead: (feedId: number) => void;
  onEditFeed: () => void;
  onDeleteFeed: () => void;
}

export function ItemList({
  feed,
  activeItemId,
  onSelectItem,
  onMarkAllRead,
  onEditFeed,
  onDeleteFeed,
}: ItemListProps) {
  const sortedItems = useMemo(() => {
    if (!feed) return [];
    return [...feed.feedItems].sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );
  }, [feed]);

  const unread = useMemo(
    () => sortedItems.reduce((n, i) => n + (i.readAt === null ? 1 : 0), 0),
    [sortedItems]
  );

  if (!feed) {
    return (
      <section className="tp-items">
        <div className="tp-items-empty">Select a feed</div>
      </section>
    );
  }

  const handleMarkAll = () => {
    if (unread === 0) return;
    onMarkAllRead(feed.id);
    markFeedRead(feed.uuid, () => {});
  };

  return (
    <section className="tp-items">
      <header className="tp-items-head">
        <div className="tp-items-head-info">
          <h2 className="tp-items-head-title">
            <a href={feed.homepage || feed.url} target="_blank" rel="noopener noreferrer">
              {feed.name}
            </a>
          </h2>
          <p className="bc-meta">
            {sortedItems.length} items · {unread} unread
          </p>
        </div>
        <div className="tp-items-head-actions">
          <button
            type="button"
            className="btn-icon"
            onClick={onEditFeed}
            aria-label="Edit feed"
            title="Edit feed"
          >
            <FontAwesomeIcon icon={faPencil} />
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={onDeleteFeed}
            aria-label="Delete feed"
            title="Delete feed"
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
          <button
            type="button"
            className={`btn-icon${unread === 0 ? " btn-icon--disabled" : ""}`}
            onClick={handleMarkAll}
            disabled={unread === 0}
            aria-label="Mark all read"
            title="Mark all read"
          >
            <FontAwesomeIcon icon={faCheckDouble} />
          </button>
        </div>
      </header>
      <ul className="tp-item-list">
        {sortedItems.map(item => {
          const isUnread = item.readAt === null;
          const isActive = item.id === activeItemId;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`tp-item${isActive ? " tp-item--active" : ""}${isUnread ? " tp-item--unread" : ""}`}
                onClick={() => onSelectItem(item.id)}
              >
                <span className="tp-item-meta">
                  <span
                    className={`tp-bullet${isUnread ? " tp-bullet--unread" : ""}`}
                    aria-hidden
                  />
                  <span className={`tp-favicon tp-favicon--xs ${feedHueClass(feed)}`} aria-hidden>
                    {feedInitials(feed.name)}
                  </span>
                  <span className="tp-item-source">{feed.name}</span>
                  <span className="tp-item-time">{formatRelativeShort(item.pubDate)}</span>
                </span>
                <span className="tp-item-title">{item.title}</span>
              </button>
            </li>
          );
        })}
        {sortedItems.length === 0 && <li className="tp-empty">No items yet.</li>}
      </ul>
    </section>
  );
}

export default ItemList;
