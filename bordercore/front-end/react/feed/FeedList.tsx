import React, { useState, useCallback, useEffect } from "react";
import { doPost } from "../utils/reactUtils";
import type { Feed } from "./types";

interface FeedListProps {
  feedList: Feed[];
  currentFeed: Feed | null;
  feedSortUrl: string;
  storeInSessionUrl: string;
  onShowFeed: (feed: Feed) => void;
  onEditFeed: () => void;
  onReorder: (reorderedList: Feed[]) => void;
}

export function FeedList({
  feedList,
  currentFeed,
  feedSortUrl,
  storeInSessionUrl,
  onShowFeed,
  onEditFeed,
  onReorder,
}: FeedListProps) {
  const [localFeedList, setLocalFeedList] = useState<Feed[]>(feedList);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Sync local list when prop changes (e.g., after add/delete)
  useEffect(() => {
    setLocalFeedList(feedList);
  }, [feedList]);

  const handleClick = useCallback(
    (feed: Feed) => {
      onShowFeed(feed);

      doPost(
        storeInSessionUrl,
        {
          current_feed: feed.id,
        },
        () => {}
      );
    },
    [storeInSessionUrl, onShowFeed]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index.toString());
      setDraggingIndex(index);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (draggingIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [draggingIndex]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
      e.preventDefault();
      const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);

      if (!isNaN(dragIndex) && dragIndex !== dropIndex) {
        // Reorder the list locally for immediate visual feedback
        const newList = [...localFeedList];
        const [draggedItem] = newList.splice(dragIndex, 1);
        newList.splice(dropIndex, 0, draggedItem);

        setLocalFeedList(newList);
        onReorder(newList);

        // Position is 1-indexed for the backend
        const newPosition = dropIndex + 1;

        doPost(
          feedSortUrl,
          {
            feed_id: draggedItem.id,
            position: newPosition,
          },
          () => {}
        );
      }

      setDraggingIndex(null);
      setDragOverIndex(null);
    },
    [localFeedList, feedSortUrl, onReorder]
  );

  if (localFeedList.length === 0) {
    return (
      <div className="text-secondary">
        No feeds found.{" "}
        <a href="#" onClick={(e) => { e.preventDefault(); onEditFeed(); }}>
          Add a new one here.
        </a>
      </div>
    );
  }

  return (
    <ul>
      {localFeedList.map((feed, index) => (
        <div
          key={feed.uuid}
          className={`slicklist-item ${dragOverIndex === index ? "drag-over" : ""} ${draggingIndex === index ? "dragging" : ""}`}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
        >
          <div className="slicklist-list-item-inner">
            <li
              className={`feed-item ps-2 ${currentFeed?.id === feed.id ? "selected rounded-sm" : ""}`}
            >
              <a
                href="#"
                data-id={feed.id}
                onClick={(e) => {
                  e.preventDefault();
                  handleClick(feed);
                }}
              >
                {feed.name}
              </a>
              {feed.lastResponse !== "OK" && (
                <small className="text-danger ms-2">{feed.lastResponse}</small>
              )}
            </li>
          </div>
        </div>
      ))}
    </ul>
  );
}

export default FeedList;
