import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from "react";
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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";
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
        <ul className="ps-0">
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
  const elRef = useRef<HTMLDivElement | null>(null);

  const refCallback = useCallback(
    (el: HTMLDivElement | null) => {
      setNodeRef(el);
      elRef.current = el;
    },
    [setNodeRef]
  );

  useLayoutEffect(() => {
    const el = elRef.current;
    if (el) {
      el.style.setProperty(
        "--sortable-transform",
        transform ? CSS.Transform.toString(transform) : "none"
      );
      el.style.setProperty("--sortable-transition", transition ?? "none");
    }
  }, [transform, transition]);

  return (
    <div
      ref={refCallback}
      className={`slicklist-item sortable-slicklist-item ${isDragging ? "dragging" : ""}`}
    >
      <div className="slicklist-list-item-inner">
        <li
          className={`feed-item ps-2 d-flex align-items-center hover-reveal-target ${
            currentFeed?.id === feed.id ? "selected rounded-sm" : ""
          }`}
        >
          <div
            className="drag-handle hover-reveal-object pe-3 cursor-grab"
            {...attributes}
            {...listeners}
          >
            <FontAwesomeIcon icon={faBars} />
          </div>
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
