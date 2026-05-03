import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import type { Feed, FeedStatus } from "./types";
import { feedHueClass, feedInitials } from "./utils/favicon";

interface FeedSidebarProps {
  feedList: Feed[];
  activeFeedId: number | null;
  onSelectFeed: (feedId: number) => void;
  onNewFeed: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function feedStatus(feed: Feed): FeedStatus {
  const code = feed.lastResponseCode;
  if (code !== null && code >= 500) return "danger";
  if (code !== null && code >= 400) return "warn";
  if (!feed.lastCheck) return "warn";
  if (Date.now() - new Date(feed.lastCheck).getTime() > DAY_MS) return "warn";
  return "ok";
}

function unreadCount(feed: Feed): number {
  return feed.feedItems.reduce((n, item) => n + (item.readAt === null ? 1 : 0), 0);
}

export function FeedSidebar({ feedList, activeFeedId, onSelectFeed, onNewFeed }: FeedSidebarProps) {
  return (
    <aside className="tp-folders">
      <div className="tp-folders-head">
        <span className="bc-label">feeds</span>
        <button
          type="button"
          className="btn-icon"
          onClick={onNewFeed}
          aria-label="New feed"
          title="New feed"
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
      </div>
      <ul className="tp-feed-list">
        {feedList.map(feed => {
          const status = feedStatus(feed);
          const unread = unreadCount(feed);
          const isActive = feed.id === activeFeedId;
          return (
            <li key={feed.id}>
              <button
                type="button"
                className={`tp-feed${isActive ? " tp-feed--active" : ""}`}
                onClick={() => onSelectFeed(feed.id)}
              >
                <span className={`tp-favicon ${feedHueClass(feed)}`} aria-hidden>
                  {feedInitials(feed.name)}
                </span>
                <span className="tp-feed-name">{feed.name}</span>
                {status !== "ok" && (
                  <span
                    className={`tp-status-dot tp-status-dot--${status}`}
                    title={status === "danger" ? "Feed error" : "Feed stale"}
                  />
                )}
                {unread > 0 && <span className="tp-feed-unread">{unread}</span>}
              </button>
            </li>
          );
        })}
        {feedList.length === 0 && <li className="tp-empty">No feeds yet. Click + to add one.</li>}
      </ul>
    </aside>
  );
}

export default FeedSidebar;
