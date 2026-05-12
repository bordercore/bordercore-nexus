import React, { useState, useMemo, useRef, useLayoutEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faPencilAlt, faThumbTack, faTrashAlt } from "@fortawesome/free-solid-svg-icons";
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
import markdownit from "markdown-it";
import { DropDownMenu } from "../common/DropDownMenu";
import { doPost } from "../utils/reactUtils";
import { tagStyle } from "../utils/tagColors";
import type { Bookmark, ViewType } from "./types";

// Unescape HTML entities in bookmark names
function unescapeHtml(html: string): string {
  const el = document.createElement("div");
  return html.replace(/&[#0-9a-z]+;/gi, enc => {
    el.innerHTML = enc;
    return el.innerText;
  });
}

// Extract hostname from URL, returning empty string for malformed URLs
function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

interface SortableBookmarkRowProps {
  bookmark: Bookmark;
  viewType: ViewType;
  selectedTagName: string | null;
  selectedBookmarkUuid: string | null;
  onClickBookmark: (uuid: string) => void;
  onEditBookmark: (uuid: string) => void;
  onDeleteBookmark: (uuid: string) => void;
  onClickTag: (tagName: string) => void;
  onPinBookmark: (uuid: string) => void;
  onUnpinBookmark: (uuid: string) => void;
  dragDisabled: boolean;
}

function SortableBookmarkRow({
  bookmark,
  viewType,
  selectedTagName,
  selectedBookmarkUuid,
  onClickBookmark,
  onEditBookmark,
  onDeleteBookmark,
  onClickTag,
  onPinBookmark,
  onUnpinBookmark,
  dragDisabled,
}: SortableBookmarkRowProps) {
  const [showYtDuration, setShowYtDuration] = useState(false);
  const markdown = useMemo(() => markdownit(), []);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bookmark.uuid,
    disabled: dragDisabled,
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
      el.style.setProperty("--sortable-transform", CSS.Transform.toString(transform) ?? "none");
      el.style.setProperty("--sortable-transition", transition ?? "none");
    }
  }, [transform, transition]);

  const filteredTags = bookmark.tags;

  const isYouTubeVideo =
    bookmark.url.startsWith("https://www.youtube.com/watch") && viewType === "normal";

  const hostname = getHostname(bookmark.url);

  // Favicon HTML is a trusted server-rendered <img> tag from the app's own database
  const faviconHtml = bookmark.favicon_url || "";
  // Note is trusted user-created markdown from the app's own database
  const noteHtml = bookmark.note ? markdown.render(bookmark.note) : "";

  return (
    <div
      ref={refCallback}
      role="row"
      data-uuid={bookmark.uuid}
      className={`data-grid-row bookmark-grid-row sortable-row hover-reveal-target bookmark-row ${
        viewType === "compact" ? "compact" : ""
      } ${selectedBookmarkUuid === bookmark.uuid ? "selected" : ""} ${
        isDragging ? "dragging" : ""
      } ${dragDisabled ? "no-drag" : ""}`}
      onClick={() => onClickBookmark(bookmark.uuid)}
      onMouseEnter={() => setShowYtDuration(true)}
      onMouseLeave={() => setShowYtDuration(false)}
    >
      {/* Drag handle */}
      <div
        role="cell"
        className="bookmark-col-drag drag-handle-cell"
        {...(dragDisabled ? {} : { ...attributes, ...listeners })}
        onClick={e => e.stopPropagation()}
      >
        <div className="hover-reveal-object">
          <FontAwesomeIcon icon={faBars} />
        </div>
      </div>

      {/* Content: icon box + title + hostname + note */}
      <div role="cell" className="bookmark-col-content content-cell">
        <div className="flex items-center gap-4 overflow-hidden relative w-full">
          <div className="bookmark-icon-box">
            {viewType === "compact" ? (
              faviconHtml ? (
                <div
                  className="favicon-container"
                  dangerouslySetInnerHTML={{ __html: faviconHtml }}
                />
              ) : null
            ) : bookmark.thumbnail_url ? (
              <img src={bookmark.thumbnail_url} alt="" loading="lazy" />
            ) : faviconHtml ? (
              <div
                className="favicon-container"
                dangerouslySetInnerHTML={{ __html: faviconHtml }}
              />
            ) : null}
          </div>
          <div className="overflow-hidden">
            <a
              className="bookmark-title-link"
              href={bookmark.url}
              id={bookmark.linkId}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
            >
              {unescapeHtml(bookmark.name)}
            </a>
            {hostname && (
              <a
                className="bookmark-hostname"
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
              >
                {hostname}
              </a>
            )}
            {noteHtml && (
              <div className="table-note" dangerouslySetInnerHTML={{ __html: noteHtml }} />
            )}
          </div>
          {isYouTubeVideo && showYtDuration && bookmark.video_duration && (
            <div className="yt-hover-target absolute text-secondary">
              {bookmark.video_duration}
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      <div role="cell" className="bookmark-col-tags tags-cell">
        {filteredTags.map(tag => (
          <a
            key={tag}
            className="tag me-2"
            style={tagStyle(tag)} // must remain inline
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onClickTag(tag);
            }}
            href="#"
          >
            {tag}
          </a>
        ))}
      </div>

      {/* Date */}
      <div role="cell" className="bookmark-col-date date-cell">
        {bookmark.created || "\u00A0"}
      </div>

      {/* Actions */}
      <div role="cell" className="bookmark-col-actions actions-cell">
        <DropDownMenu
          allowFlip={false}
          dropdownSlot={
            <ul className="dropdown-menu-list">
              <li>
                <button
                  className="dropdown-menu-item"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEditBookmark(bookmark.uuid);
                  }}
                >
                  <span className="dropdown-menu-icon">
                    <FontAwesomeIcon icon={faPencilAlt} />
                  </span>
                  <span className="dropdown-menu-text">Edit</span>
                </button>
              </li>
              <li>
                <button
                  className="dropdown-menu-item"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (bookmark.is_pinned) {
                      onUnpinBookmark(bookmark.uuid);
                    } else {
                      onPinBookmark(bookmark.uuid);
                    }
                  }}
                >
                  <span className="dropdown-menu-icon">
                    <FontAwesomeIcon icon={faThumbTack} />
                  </span>
                  <span className="dropdown-menu-text">{bookmark.is_pinned ? "Unpin" : "Pin"}</span>
                </button>
              </li>
              <li>
                <button
                  className="dropdown-menu-item"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDeleteBookmark(bookmark.uuid);
                  }}
                >
                  <span className="dropdown-menu-icon">
                    <FontAwesomeIcon icon={faTrashAlt} />
                  </span>
                  <span className="dropdown-menu-text">Delete</span>
                </button>
              </li>
            </ul>
          }
        />
      </div>
    </div>
  );
}

interface BookmarkListProps {
  bookmarks: Bookmark[];
  viewType: ViewType;
  selectedTagName: string | null;
  selectedBookmarkUuid: string | null;
  sortUrl: string;
  editBookmarkUrl: string;
  onBookmarksChange: (bookmarks: Bookmark[]) => void;
  onClickBookmark: (uuid: string) => void;
  onEditBookmark: (uuid: string) => void;
  onDeleteBookmark: (uuid: string) => void;
  onClickTag: (tagName: string) => void;
  onPinBookmark: (uuid: string) => void;
  onUnpinBookmark: (uuid: string) => void;
}

export function BookmarkList({
  bookmarks,
  viewType,
  selectedTagName,
  selectedBookmarkUuid,
  sortUrl,
  editBookmarkUrl,
  onBookmarksChange,
  onClickBookmark,
  onEditBookmark,
  onDeleteBookmark,
  onClickTag,
  onPinBookmark,
  onUnpinBookmark,
}: BookmarkListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isUntagged = selectedTagName === "Untagged";
  const dragDisabled = isUntagged;

  const activeBookmark = useMemo(() => {
    return activeId ? bookmarks.find(b => b.uuid === activeId) : null;
  }, [activeId, bookmarks]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over || active.id === over.id) return;
    if (selectedTagName === "Untagged") return;

    const oldIndex = bookmarks.findIndex(item => item.uuid === active.id);
    const newIndex = bookmarks.findIndex(item => item.uuid === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newList = arrayMove(bookmarks, oldIndex, newIndex);
      onBookmarksChange(newList);

      // Backend expects 1-indexed position
      const newPosition = newIndex + 1;
      doPost(
        sortUrl,
        {
          tag: selectedTagName || "",
          bookmark_uuid: active.id.toString(),
          position: newPosition.toString(),
        },
        () => {},
        "",
        "Sort error"
      );
    }
  };

  // Trusted server-rendered favicon HTML for drag overlay
  const activeFaviconHtml = activeBookmark?.favicon_url || "";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        id="bookmark-list-container"
        className="scrollable-panel-scrollbar-hover h-full data-grid-container bookmark-grid-container"
      >
        <div className={`data-grid bookmark-grid ${isUntagged ? "hide-tags" : ""}`} role="table">
          <div
            className={`data-grid-header bookmark-grid-header ${
              viewType === "compact" ? "compact" : ""
            }`}
            role="row"
          >
            <div role="columnheader"></div>
            <div role="columnheader">Name &amp; URL</div>
            <div role="columnheader" className="bookmark-tags-col">
              {viewType !== "compact" ? "Tags" : ""}
            </div>
            <div role="columnheader">Date</div>
            <div role="columnheader"></div>
          </div>
          <div className="data-grid-body bookmark-grid-body" role="rowgroup">
            <SortableContext
              items={bookmarks.map(b => b.uuid)}
              strategy={verticalListSortingStrategy}
            >
              {bookmarks.map(bookmark => (
                <SortableBookmarkRow
                  key={bookmark.uuid}
                  bookmark={bookmark}
                  viewType={viewType}
                  selectedTagName={selectedTagName}
                  selectedBookmarkUuid={selectedBookmarkUuid}
                  onClickBookmark={onClickBookmark}
                  onEditBookmark={onEditBookmark}
                  onDeleteBookmark={onDeleteBookmark}
                  onClickTag={onClickTag}
                  onPinBookmark={onPinBookmark}
                  onUnpinBookmark={onUnpinBookmark}
                  dragDisabled={dragDisabled}
                />
              ))}
            </SortableContext>
          </div>
        </div>
        {bookmarks.length === 0 && <div className="text-center pt-4">No bookmarks found.</div>}
      </div>
      <DragOverlay>
        {activeBookmark ? (
          <div
            className={`data-grid-row bookmark-grid-row bookmark-row data-table-drag-overlay ${
              viewType === "compact" ? "compact" : ""
            }`}
          >
            <div role="cell" className="bookmark-col-drag drag-handle-cell">
              <FontAwesomeIcon icon={faBars} />
            </div>
            <div role="cell" className="bookmark-col-content content-cell">
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="bookmark-icon-box">
                  {viewType === "compact" ? (
                    activeFaviconHtml ? (
                      <div
                        className="favicon-container"
                        dangerouslySetInnerHTML={{ __html: activeFaviconHtml }}
                      />
                    ) : null
                  ) : activeBookmark.thumbnail_url ? (
                    <img src={activeBookmark.thumbnail_url} alt="" />
                  ) : activeFaviconHtml ? (
                    <div
                      className="favicon-container"
                      dangerouslySetInnerHTML={{ __html: activeFaviconHtml }}
                    />
                  ) : null}
                </div>
                <div className="overflow-hidden">
                  <span className="bookmark-title-link">{unescapeHtml(activeBookmark.name)}</span>
                  {viewType !== "compact" &&
                    (() => {
                      const h = getHostname(activeBookmark.url);
                      return h ? <span className="bookmark-hostname">{h}</span> : null;
                    })()}
                </div>
              </div>
            </div>
            <div role="cell" className="bookmark-col-tags tags-cell">
              {activeBookmark.tags.map(tag => (
                <span
                  key={tag}
                  className="tag me-2"
                  style={tagStyle(tag)} // must remain inline
                >
                  {tag}
                </span>
              ))}
            </div>
            <div role="cell" className="bookmark-col-date date-cell">
              {activeBookmark.created || "\u00A0"}
            </div>
            <div role="cell" className="bookmark-col-actions actions-cell"></div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default BookmarkList;
