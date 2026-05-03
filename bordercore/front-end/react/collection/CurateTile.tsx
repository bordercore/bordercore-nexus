import React, { useCallback, useLayoutEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGripVertical,
  faImage,
  faLink,
  faPencilAlt,
  faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CollectionObject } from "./types";

interface CurateTileProps {
  object: CollectionObject;
  shuffled: boolean;
  onThumbClick: (object: CollectionObject) => void;
  onRemove: (object: CollectionObject) => void;
  onTagClick: (tag: string) => void;
}

export function CurateTile({
  object,
  shuffled,
  onThumbClick,
  onRemove,
  onTagClick,
}: CurateTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: object.uuid,
    disabled: shuffled,
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

  const handleThumbClick = useCallback(() => {
    onThumbClick(object);
  }, [object, onThumbClick]);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove(object);
    },
    [object, onRemove]
  );

  const isBlob = object.type === "blob";
  const displayName = object.name?.trim() || "untitled";
  const isUntitled = !object.name?.trim();

  const tileClass = ["cd-tile", isDragging ? "dragging" : "", shuffled ? "shuffled" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={refCallback} className={tileClass} data-type={object.type} {...attributes}>
      <div className="cd-tile-chrome">
        <button type="button" className="cd-handle" aria-label="Drag to reorder" {...listeners}>
          <FontAwesomeIcon icon={faGripVertical} />
        </button>
        <div className="cd-tile-actions">
          <a
            href={object.edit_url}
            className="cd-action-edit"
            aria-label="Edit"
            onPointerDown={e => e.stopPropagation()}
          >
            <FontAwesomeIcon icon={faPencilAlt} />
          </a>
          <button
            type="button"
            className="cd-action-remove"
            aria-label="Remove from collection"
            onClick={handleRemove}
            onPointerDown={e => e.stopPropagation()}
          >
            <FontAwesomeIcon icon={faTrashAlt} />
          </button>
        </div>
      </div>

      {isBlob ? (
        <div
          className="cd-thumb"
          onClick={handleThumbClick}
          onPointerDown={e => e.stopPropagation()}
        >
          <img src={object.cover_url} alt={displayName} loading="lazy" />
        </div>
      ) : (
        <a
          href={object.url}
          target="_blank"
          rel="noopener noreferrer"
          className="cd-thumb cd-thumb-bookmark"
          onPointerDown={e => e.stopPropagation()}
        >
          <FontAwesomeIcon icon={faLink} />
        </a>
      )}

      <div className="cd-meta">
        <div className="cd-meta-top">
          <div className={isUntitled ? "cd-name empty" : "cd-name"}>
            {isBlob ? (
              <a href={object.url} onPointerDown={e => e.stopPropagation()}>
                {displayName}
              </a>
            ) : (
              <a
                href={object.url}
                target="_blank"
                rel="noopener noreferrer"
                onPointerDown={e => e.stopPropagation()}
              >
                {displayName}
              </a>
            )}
          </div>
          <div className="cd-type-icon" aria-hidden="true">
            <FontAwesomeIcon icon={isBlob ? faImage : faLink} />
          </div>
        </div>

        {object.note && <div className="cd-note">{object.note}</div>}

        {object.tags && object.tags.length > 0 && (
          <div className="cd-mini-tags">
            {object.tags.slice(0, 3).map(tag => (
              <button
                key={tag}
                type="button"
                className="cd-mini-tag"
                onClick={() => onTagClick(tag)}
                onPointerDown={e => e.stopPropagation()}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CurateTile;
