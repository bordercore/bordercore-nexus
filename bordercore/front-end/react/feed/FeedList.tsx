import React, { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = localFeedList.findIndex(item => item.uuid === active.id);
        const newIndex = localFeedList.findIndex(item => item.uuid === over.id);

        const newList = arrayMove(localFeedList, oldIndex, newIndex);
        setLocalFeedList(newList);
        onReorder(newList);

        const draggedItem = localFeedList[oldIndex];
        // Position is 1-indexed for the backend
        const newPosition = newIndex + 1;

        doPost(
          feedSortUrl,
          {
            feed_id: draggedItem.id,
            position: newPosition,
          },
          () => {}
        );
      }
    },
    [localFeedList, feedSortUrl, onReorder]
  );

  if (localFeedList.length === 0) {
    return (
      <div className="text-secondary">
        No feeds found.{" "}
        <a
          href="#"
          onClick={e => {
            e.preventDefault();
            onEditFeed();
          }}
        >
          Add a new one here.
        </a>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={localFeedList.map(feed => feed.uuid)}
        strategy={verticalListSortingStrategy}
      >
        <ul>
          {localFeedList.map(feed => (
            <SortableFeedItem
              key={feed.uuid}
              feed={feed}
              currentFeed={currentFeed}
              handleClick={handleClick}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

export default FeedList;

interface SortableFeedItemProps {
  feed: Feed;
  currentFeed: Feed | null;
  handleClick: (feed: Feed) => void;
}

function SortableFeedItem({ feed, currentFeed, handleClick }: SortableFeedItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: feed.uuid,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    position: "relative" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`slicklist-item ${isDragging ? "dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className="slicklist-list-item-inner">
        <li
          className={`feed-item ps-2 ${currentFeed?.id === feed.id ? "selected rounded-sm" : ""}`}
        >
          <a
            href="#"
            data-id={feed.id}
            onClick={e => {
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
  );
}
