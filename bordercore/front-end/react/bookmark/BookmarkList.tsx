import React, { useState, useMemo, useRef, useLayoutEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faPencilAlt, faTrashAlt } from "@fortawesome/free-solid-svg-icons";
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
import type { Bookmark, ViewType } from "./types";

// Unescape HTML entities in bookmark names
function unescapeHtml(html: string): string {
  const el = document.createElement("div");
  return html.replace(/&[#0-9a-z]+;/gi, enc => {
    el.innerHTML = enc;
    return el.innerText;
  });
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
      el.style.setProperty(
        "--sortable-transform",
        transform ? CSS.Transform.toString(transform) : "none"
      );
      el.style.setProperty("--sortable-transition", transition ?? "none");
    }
  }, [transform, transition]);

  // Filter out the currently selected tag from display
  const filteredTags = bookmark.tags.filter(tag => tag !== selectedTagName);

  const getNote = (note: string): string => {
    return markdown.render(note);
  };

  const isYouTubeVideo =
    bookmark.url.startsWith("https://www.youtube.com/watch") && viewType === "normal";

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

      {/* Date */}
      <div role="cell" className="bookmark-col-date date-cell">
        {bookmark.created || "\u00A0"}
      </div>

      {/* Thumbnail - only in normal view */}
      {viewType !== "compact" && (
        <div role="cell" className="bookmark-col-thumbnail thumbnail-cell">
          {bookmark.thumbnail_url && (
            <img width="120" height="67" src={bookmark.thumbnail_url} alt="" />
          )}
        </div>
      )}

      {/* Content: title, tags, note */}
      <div role="cell" className="bookmark-col-content content-cell h-100 pt-3 align-items-start">
        <div className="position-relative d-flex align-items-start">
          {bookmark.favicon_url && (
            <div
              className="favicon-container me-2 mt-2"
              dangerouslySetInnerHTML={{ __html: bookmark.favicon_url }}
            />
          )}
          <div>
            <a
              className="me-2"
              href={bookmark.url}
              id={bookmark.linkId}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
            >
              {unescapeHtml(bookmark.name)}
            </a>
            {filteredTags.map(tag => (
              <a
                key={tag}
                className="tag ms-2 d-inline-block"
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
            {isYouTubeVideo && showYtDuration && bookmark.video_duration && (
              <div className="yt-hover-target position-absolute text-secondary">
                {bookmark.video_duration}
              </div>
            )}
            {/* note is trusted user-created markdown from the app's own database */}
            {bookmark.note && (
              <div
                className="table-note"
                dangerouslySetInnerHTML={{ __html: getNote(bookmark.note) }}
              />
            )}
          </div>
        </div>
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

  const dragDisabled = selectedTagName === "Untagged";

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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        id="bookmark-list-container"
        className="scrollable-panel-scrollbar-hover h-100 data-grid-container bookmark-grid-container"
      >
        <div className="data-grid bookmark-grid" role="table">
          <div
            className={`data-grid-header bookmark-grid-header ${
              viewType === "compact" ? "compact" : ""
            }`}
            role="row"
          >
            <div role="columnheader"></div>
            <div role="columnheader">Date</div>
            {viewType !== "compact" && (
              <div role="columnheader" className="bookmark-link-col">
                Link
              </div>
            )}
            {viewType === "compact" && (
              <div role="columnheader" className="bookmark-link-col">
                Link
              </div>
            )}
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
                  dragDisabled={dragDisabled}
                />
              ))}
            </SortableContext>
          </div>
        </div>
        {bookmarks.length === 0 && <div className="text-center pt-3">No bookmarks found.</div>}
      </div>
      <DragOverlay>
        {activeBookmark ? (
          <div
            className={`data-grid-row bookmark-grid-row data-table-drag-overlay ${
              viewType === "compact" ? "compact" : ""
            }`}
          >
            <div role="cell" className="bookmark-col-drag drag-handle-cell">
              <FontAwesomeIcon icon={faBars} />
            </div>
            <div role="cell" className="bookmark-col-date date-cell">
              {activeBookmark.created || "\u00A0"}
            </div>
            {viewType !== "compact" && (
              <div role="cell" className="bookmark-col-thumbnail thumbnail-cell">
                {activeBookmark.thumbnail_url && (
                  <img width="120" height="67" src={activeBookmark.thumbnail_url} alt="" />
                )}
              </div>
            )}
            <div
              role="cell"
              className="bookmark-col-content content-cell h-100 pt-3 align-items-start"
            >
              <div className="position-relative d-flex align-items-start">
                {activeBookmark.favicon_url && (
                  <div
                    className="favicon-container me-2"
                    dangerouslySetInnerHTML={{ __html: activeBookmark.favicon_url }}
                  />
                )}
                <div>
                  <span>{unescapeHtml(activeBookmark.name)}</span>
                  {activeBookmark.tags
                    .filter(tag => tag !== selectedTagName)
                    .map(tag => (
                      <span key={tag} className="tag ms-2">
                        {tag}
                      </span>
                    ))}
                </div>
              </div>
            </div>
            <div role="cell" className="bookmark-col-actions actions-cell"></div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default BookmarkList;
