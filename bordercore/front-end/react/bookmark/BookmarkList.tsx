import React, { useState, useMemo, useRef, useLayoutEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faPencilAlt,
  faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
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
  return html.replace(/&[#0-9a-z]+;/gi, (enc) => {
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

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: bookmark.uuid,
    disabled: dragDisabled,
  });

  const nodeRef = useRef<HTMLTableRowElement | null>(null);
  const setRef = (el: HTMLTableRowElement | null) => {
    setNodeRef(el);
    nodeRef.current = el;
  };

  useLayoutEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    el.style.transform = CSS.Transform.toString(transform);
    el.style.transition = transition;
  }, [transform, transition]);

  // Filter out the currently selected tag from display
  const filteredTags = bookmark.tags.filter((tag) => tag !== selectedTagName);

  const getNote = (note: string): string => {
    return markdown.render(note);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-bookmark-uuid", bookmark.uuid);
    // Store in window for cross-component access
    (window as any).__draggedBookmarkUuid = bookmark.uuid;
  };

  const isYouTubeVideo =
    bookmark.url.startsWith("https://www.youtube.com/watch") &&
    viewType === "normal";

  return (
    <tr
      ref={setRef}
      data-uuid={bookmark.uuid}
      className={`hover-reveal-target bookmark-row ${
        selectedBookmarkUuid === bookmark.uuid ? "selected" : ""
      } ${isDragging ? "dragging" : ""} ${dragDisabled ? "no-drag" : ""}`}
      onClick={() => onClickBookmark(bookmark.uuid)}
      draggable={!dragDisabled}
      onDragStart={handleDragStart}
      onMouseEnter={() => setShowYtDuration(true)}
      onMouseLeave={() => setShowYtDuration(false)}
    >
      {/* Drag handle */}
      <td
        className="drag-handle-cell"
        {...(dragDisabled ? {} : { ...attributes, ...listeners })}
      >
        <div className="hover-reveal-object">
          <FontAwesomeIcon icon={faBars} />
        </div>
      </td>

      {/* Date */}
      <td className="date-cell">{bookmark.created || "\u00A0"}</td>

      {/* Thumbnail - only in normal view */}
      {viewType !== "compact" && (
        <td className="thumbnail-cell">
          {bookmark.thumbnail_url && (
            <img
              width="120"
              height="67"
              src={bookmark.thumbnail_url}
              alt=""
            />
          )}
        </td>
      )}

      {/* Favicon - trusted server-rendered HTML from the app's own database */}
      <td
        className="favicon-cell"
        dangerouslySetInnerHTML={
          bookmark.favicon_url ? { __html: bookmark.favicon_url } : undefined
        }
      />

      {/* Content: title, tags, note */}
      <td className="content-cell">
        <div className="position-relative">
          <a
            className="me-2"
            href={bookmark.url}
            id={bookmark.linkId}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {unescapeHtml(bookmark.name)}
          </a>
          {filteredTags.map((tag) => (
            <a
              key={tag}
              className="tag ms-2 d-inline-block"
              onClick={(e) => {
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
      </td>

      {/* Actions */}
      <td className="actions-cell">
        <DropDownMenu
          showOnHover={true}
          allowFlip={false}
          dropdownSlot={
            <ul className="dropdown-menu-list">
              <li>
                <a
                  className="dropdown-item"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEditBookmark(bookmark.uuid);
                  }}
                >
                  <FontAwesomeIcon
                    icon={faPencilAlt}
                    className="text-primary me-3"
                  />
                  Edit
                </a>
              </li>
              <li>
                <a
                  className="dropdown-item"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDeleteBookmark(bookmark.uuid);
                  }}
                >
                  <FontAwesomeIcon
                    icon={faTrashAlt}
                    className="text-primary me-3"
                  />
                  Delete
                </a>
              </li>
            </ul>
          }
        />
      </td>
    </tr>
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;
    if (selectedTagName === "Untagged") return;

    const oldIndex = bookmarks.findIndex((item) => item.uuid === active.id);
    const newIndex = bookmarks.findIndex((item) => item.uuid === over.id);

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
      onDragEnd={handleDragEnd}
    >
      <div
        id="bookmark-list-container"
        className="scrollable-panel-scrollbar-hover vh-100"
      >
        <table className="table bookmark-table">
          <thead className="visually-hidden">
            <tr>
              <th scope="col">Drag</th>
              <th scope="col">Date</th>
              {viewType !== "compact" && <th scope="col">Thumbnail</th>}
              <th scope="col">Icon</th>
              <th scope="col">Bookmark</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <SortableContext
              items={bookmarks.map((b) => b.uuid)}
              strategy={verticalListSortingStrategy}
            >
              {bookmarks.map((bookmark) => (
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
          </tbody>
        </table>
        {bookmarks.length === 0 && (
          <div className="text-center pt-3">No bookmarks found.</div>
        )}
      </div>
    </DndContext>
  );
}

export default BookmarkList;
