import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencilAlt, faTimes } from "@fortawesome/free-solid-svg-icons";
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { RelatedObject } from "./types";

export interface RelatedObjectsCardProps {
  items: RelatedObject[];
  loading: boolean;
  onRemove: (item: RelatedObject) => void;
  onReorder: (activeUuid: string, overUuid: string) => void;
  onEditNote: (item: RelatedObject, note: string) => void;
  /** Show "no related objects" when the list is empty (vs rendering nothing). */
  showEmptyState?: boolean;
}

/**
 * Unified, presentational related-objects list. Renders one row per object with
 * a thumbnail (or initial-letter fallback), a linked name, an inline editable
 * relationship note, hover/focus-revealed action icons, and drag-to-reorder.
 * All persistence is delegated to the callbacks (see useRelatedObjects).
 */
export function RelatedObjectsCard({
  items,
  loading,
  onRemove,
  onReorder,
  onEditNote,
  showEmptyState = true,
}: RelatedObjectsCardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        onReorder(active.id as string, over.id as string);
      }
    },
    [onReorder]
  );

  if (loading) {
    return <div className="ro-loading text-ink-3">Loading…</div>;
  }

  if (items.length === 0) {
    return showEmptyState ? <div className="ro-empty text-ink-3">No related objects</div> : null;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(i => i.uuid)} strategy={verticalListSortingStrategy}>
        <ul className="ro-list">
          {items.map(item => (
            <RelatedObjectRow
              key={item.uuid}
              item={item}
              onRemove={onRemove}
              onEditNote={onEditNote}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

interface RelatedObjectRowProps {
  item: RelatedObject;
  onRemove: (item: RelatedObject) => void;
  onEditNote: (item: RelatedObject, note: string) => void;
}

function RelatedObjectRow({ item, onRemove, onEditNote }: RelatedObjectRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.uuid,
  });
  const elRef = useRef<HTMLLIElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState(false);

  const refCallback = useCallback(
    (el: HTMLLIElement | null) => {
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

  const startEditing = useCallback(() => {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const commitNote = useCallback(
    (value: string) => {
      setEditing(false);
      onEditNote(item, value);
    },
    [item, onEditNote]
  );

  const stopDrag = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <li
      ref={refCallback}
      className={`ro-row${isDragging ? " is-dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <span className="ro-thumb" aria-hidden="true">
        {item.cover_url ? (
          <img src={item.cover_url} alt={item.name} loading="lazy" />
        ) : (
          <span className="ro-thumb-fallback">{(item.name || "?").charAt(0).toUpperCase()}</span>
        )}
      </span>

      <span className="ro-body">
        <a className="ro-name" href={item.url} onPointerDown={stopDrag}>
          {item.name}
        </a>
        {editing ? (
          <span onPointerDown={stopDrag}>
            <input
              ref={inputRef}
              type="text"
              className="ro-note-input"
              defaultValue={item.note || ""}
              autoComplete="off"
              onBlur={e => commitNote(e.target.value)}
              onKeyDown={e => {
                // Keep keystrokes (esp. Space / arrows) from reaching the
                // row's dnd-kit keyboard sensor, which would treat them as
                // drag commands instead of text input.
                e.stopPropagation();
                if (e.key === "Enter") commitNote((e.target as HTMLInputElement).value);
                if (e.key === "Escape") setEditing(false);
              }}
            />
          </span>
        ) : (
          item.note && (
            <span className="ro-note" onPointerDown={stopDrag} onClick={startEditing}>
              {item.note}
            </span>
          )
        )}
      </span>

      <span className="ro-actions" onPointerDown={stopDrag}>
        <button
          type="button"
          className="ro-act"
          onClick={startEditing}
          aria-label={item.note ? "Edit note" : "Add note"}
        >
          <FontAwesomeIcon icon={faPencilAlt} />
        </button>
        <button
          type="button"
          className="ro-act ro-act-danger"
          onClick={() => onRemove(item)}
          aria-label="Remove related object"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </span>
    </li>
  );
}

export default RelatedObjectsCard;
