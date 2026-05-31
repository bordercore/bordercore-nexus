import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faPlus } from "@fortawesome/free-solid-svg-icons";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Feed, FeedStatus } from "./types";
import { feedHueClass, feedInitials } from "./utils/favicon";

interface FeedSidebarProps {
  feedList: Feed[];
  activeFeedId: number | null;
  onSelectFeed: (feedId: number) => void;
  onNewFeed: () => void;
  onReorderFeeds: (newList: Feed[], feedId: number, position: number) => void;
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

/**
 * Compute the result of dragging the feed with `activeId` onto the position of
 * the feed with `overId`. Returns the reordered list, the moved feed's id, and
 * its new 1-indexed position (what the backend `feed:sort` endpoint expects),
 * or null if the move is a no-op or the ids aren't found.
 */
export function reorderFeedList(
  feedList: Feed[],
  activeId: number,
  overId: number
): { list: Feed[]; feedId: number; position: number } | null {
  if (activeId === overId) return null;
  const oldIndex = feedList.findIndex(f => f.id === activeId);
  const newIndex = feedList.findIndex(f => f.id === overId);
  if (oldIndex === -1 || newIndex === -1) return null;
  return {
    list: arrayMove(feedList, oldIndex, newIndex),
    feedId: activeId,
    position: newIndex + 1,
  };
}

interface SortableFeedRowProps {
  feed: Feed;
  isActive: boolean;
  status: FeedStatus;
  unread: number;
  onSelectFeed: (feedId: number) => void;
}

function SortableFeedRow({ feed, isActive, status, unread, onSelectFeed }: SortableFeedRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: feed.id,
  });
  const elRef = useRef<HTMLLIElement | null>(null);

  const refCallback = useCallback(
    (el: HTMLLIElement | null) => {
      setNodeRef(el);
      elRef.current = el;
    },
    [setNodeRef]
  );

  // Inline style props are rejected by the HTML lint test, so push dnd-kit's
  // transform/transition into CSS custom properties the stylesheet reads.
  useLayoutEffect(() => {
    const el = elRef.current;
    if (el) {
      el.style.setProperty("--sortable-transform", CSS.Transform.toString(transform) ?? "none");
      el.style.setProperty("--sortable-transition", transition ?? "none");
    }
  }, [transform, transition]);

  return (
    <li ref={refCallback} className={`tp-feed-row sortable-row${isDragging ? " dragging" : ""}`}>
      <span className="tp-feed-drag" aria-label="Drag to reorder" {...attributes} {...listeners}>
        <FontAwesomeIcon icon={faBars} />
      </span>
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
}

export function FeedSidebar({
  feedList,
  activeFeedId,
  onSelectFeed,
  onNewFeed,
  onReorderFeeds,
}: FeedSidebarProps) {
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeFeed = useMemo(
    () => (activeId !== null ? (feedList.find(f => f.id === activeId) ?? null) : null),
    [activeId, feedList]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const result = reorderFeedList(feedList, active.id as number, over.id as number);
    if (result) {
      onReorderFeeds(result.list, result.feedId, result.position);
    }
  };

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <ul className="tp-feed-list">
          <SortableContext items={feedList.map(f => f.id)} strategy={verticalListSortingStrategy}>
            {feedList.map(feed => (
              <SortableFeedRow
                key={feed.id}
                feed={feed}
                isActive={feed.id === activeFeedId}
                status={feedStatus(feed)}
                unread={unreadCount(feed)}
                onSelectFeed={onSelectFeed}
              />
            ))}
          </SortableContext>
          {feedList.length === 0 && <li className="tp-empty">No feeds yet. Click + to add one.</li>}
        </ul>
        <DragOverlay>
          {activeFeed ? (
            <div className="tp-feed tp-feed-drag-overlay">
              <span className={`tp-favicon ${feedHueClass(activeFeed)}`} aria-hidden>
                {feedInitials(activeFeed.name)}
              </span>
              <span className="tp-feed-name">{activeFeed.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </aside>
  );
}

export default FeedSidebar;
