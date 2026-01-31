import React, { useState, useCallback, useRef, useLayoutEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { doPost } from "../utils/reactUtils";
import type { PinnedTag } from "./types";

interface SortableTagItemProps {
  tag: PinnedTag;
  isSelected: boolean;
  onClickTag: (tagName: string) => void;
  onBookmarkDrop: (tagId: number, tagName: string) => void;
  bookmarkDragData: string | null;
}

function SortableTagItem({
  tag,
  isSelected,
  onClickTag,
  onBookmarkDrop,
  bookmarkDragData,
}: SortableTagItemProps) {
  const isUntagged = tag.name === "Untagged";
  const [isDragOver, setIsDragOver] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: tag.id.toString(),
    disabled: isUntagged,
  });

  const nodeRef = useRef<HTMLDivElement | null>(null);
  const setRef = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    nodeRef.current = el;
  };

  useLayoutEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    el.style.transform = CSS.Transform.toString(transform);
    el.style.transition = transition;
  }, [transform, transition]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const bookmarkUuid = e.dataTransfer.getData("application/x-bookmark-uuid");
    if (bookmarkUuid) {
      onBookmarkDrop(tag.id, tag.name);
    }
  };

  return (
    <div
      ref={setRef}
      className={`slicklist-item ${isDragging ? "dragging" : ""} ${isUntagged ? "no-drag" : ""}`}
    >
      <div className="slicklist-list-item-inner">
        <li
          className={`list-with-counts rounded d-flex ps-2 py-1 pr-1 ${
            isSelected ? "selected" : ""
          } ${isDragOver ? "hover-tag" : ""}`}
          data-tag={tag.name}
          data-id={tag.id}
          onClick={() => onClickTag(tag.name)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          {...(isUntagged ? {} : { ...attributes, ...listeners })}
        >
          <div className="ps-2 text-truncate">{tag.name}</div>
          {tag.bookmark_count !== undefined && tag.bookmark_count > 0 && (
            <div className="ms-auto pe-2">
              <span className="px-2 badge rounded-pill">
                {tag.bookmark_count}
              </span>
            </div>
          )}
        </li>
      </div>
    </div>
  );
}

interface BookmarkPinnedTagsProps {
  tags: PinnedTag[];
  selectedTagName: string | null;
  addTagUrl: string;
  removeTagUrl: string;
  sortTagsUrl: string;
  onTagsChange: (tags: PinnedTag[]) => void;
  onSearchTag: (tagName: string) => void;
  onGetPage: (pageNumber: number) => void;
}

export function BookmarkPinnedTags({
  tags,
  selectedTagName,
  addTagUrl,
  removeTagUrl,
  sortTagsUrl,
  onTagsChange,
  onSearchTag,
  onGetPage,
}: BookmarkPinnedTagsProps) {
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tags.findIndex(
        (item) => item.id.toString() === active.id
      );
      const newIndex = tags.findIndex(
        (item) => item.id.toString() === over.id
      );

      if (oldIndex !== -1 && newIndex !== -1) {
        const newList = arrayMove(tags, oldIndex, newIndex);
        onTagsChange(newList);

        const tagId = tags[oldIndex].id;
        doPost(
          sortTagsUrl,
          {
            tag_id: tagId.toString(),
            new_position: newIndex.toString(),
          },
          () => {},
          "",
          "Error sorting tags"
        );
      }
    }
  };

  const handleTagClick = useCallback(
    (tagName: string) => {
      onSearchTag(tagName);
    },
    [onSearchTag]
  );

  const handleBookmarkDrop = useCallback(
    (tagId: number, tagName: string) => {
      // Get the bookmark UUID from the custom data attribute set during drag
      const bookmarkUuid = (window as any).__draggedBookmarkUuid;
      if (!bookmarkUuid) return;

      // Ignore if we're dragging a bookmark from a tag list onto the same tag
      if (tagName === selectedTagName) {
        return;
      }

      if (tagId === -1) {
        // Moving to "Untagged" means removing the current tag
        doPost(
          removeTagUrl,
          {
            tag_name: selectedTagName || "",
            bookmark_uuid: bookmarkUuid,
          },
          () => {
            onSearchTag(selectedTagName || "Untagged");
          },
          "",
          "Error removing tag"
        );
      } else {
        // Add the tag to the bookmark
        doPost(
          addTagUrl,
          {
            tag_id: tagId.toString(),
            bookmark_uuid: bookmarkUuid,
          },
          () => {
            onGetPage(1);
          },
          "",
          "Error adding tag"
        );
      }
    },
    [selectedTagName, removeTagUrl, addTagUrl, onSearchTag, onGetPage]
  );

  return (
    <div className="card-body backdrop-filter h-100 bookmark-pinned-tags">
      <div className="card-title-large">Pinned Tags</div>
      <hr className="divider" />
      <ul className="list-group flex-column w-100">
        <div id="tag-list">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tags.map((t) => t.id.toString())}
              strategy={verticalListSortingStrategy}
            >
              {tags.map((tag) => (
                <SortableTagItem
                  key={tag.id}
                  tag={tag}
                  isSelected={tag.name === selectedTagName}
                  onClickTag={handleTagClick}
                  onBookmarkDrop={handleBookmarkDrop}
                  bookmarkDragData={null}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </ul>
    </div>
  );
}

export default BookmarkPinnedTags;
