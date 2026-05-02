import React, { useCallback, useState } from "react";
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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faThumbtack, faGripVertical } from "@fortawesome/free-solid-svg-icons";
import { tagSwatchColor } from "../../utils/tagColors";
import { doPost } from "../../utils/reactUtils";
import { ImportanceDots } from "./ImportanceDots";
import type { NoteSummary } from "./types";

interface PinnedColumnProps {
  initialPinned: NoteSummary[];
  sortPinnedUrl: string;
}

interface SortablePinnedRowProps {
  note: NoteSummary;
  isFirst: boolean;
}

function SortablePinnedRow({ note, isFirst }: SortablePinnedRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.uuid,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform) ?? undefined,
    transition: transition ?? undefined,
  };

  const visibleTags = note.tags.slice(0, 2);

  return (
    <li
      ref={setNodeRef}
      // must remain inline (dnd-kit recomputes transform/transition each render)
      style={style}
      className={`nl-pin-row ${isFirst ? "is-first" : ""} ${isDragging ? "is-dragging" : ""}`}
    >
      <button
        type="button"
        className="nl-pin-handle"
        aria-label="Reorder pinned note"
        {...attributes}
        {...listeners}
      >
        <FontAwesomeIcon icon={faGripVertical} />
      </button>
      <a className="nl-pin-link" href={note.url}>
        <span className="nl-pin-title">{note.name || "untitled"}</span>
        {visibleTags.length > 0 && (
          <span className="nl-pin-tags">
            {visibleTags.map(tag => (
              <span key={tag} className="nl-pin-tag">
                <span
                  className="nl-tag-dot"
                  // must remain inline (per-tag color from runtime hash)
                  style={{ background: tagSwatchColor(tag) }}
                  aria-hidden="true"
                />
                {tag}
              </span>
            ))}
          </span>
        )}
      </a>
      <ImportanceDots importance={note.importance} />
    </li>
  );
}

export function PinnedColumn({ initialPinned, sortPinnedUrl }: PinnedColumnProps) {
  const [pinned, setPinned] = useState<NoteSummary[]>(initialPinned);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = pinned.findIndex(n => n.uuid === active.id);
      const newIndex = pinned.findIndex(n => n.uuid === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const next = arrayMove(pinned, oldIndex, newIndex);
      setPinned(next);

      doPost(
        sortPinnedUrl,
        { note_uuid: String(active.id), new_position: String(newIndex + 1) },
        () => {},
        "",
        "Error sorting pinned notes"
      );
    },
    [pinned, sortPinnedUrl]
  );

  return (
    <aside className="nl-pinned">
      <header className="nl-pinned-head">
        <span className="nl-pinned-icon" aria-hidden="true">
          <FontAwesomeIcon icon={faThumbtack} />
        </span>
        <h2 className="nl-pinned-title">Pinned</h2>
      </header>
      {pinned.length === 0 ? (
        <p className="nl-pinned-empty">No pinned notes yet.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pinned.map(n => n.uuid)} strategy={verticalListSortingStrategy}>
            <ul className="nl-pinned-list">
              {pinned.map((note, idx) => (
                <SortablePinnedRow key={note.uuid} note={note} isFirst={idx === 0} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </aside>
  );
}

export default PinnedColumn;
