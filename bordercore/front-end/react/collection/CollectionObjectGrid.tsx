import React, { useState, useCallback, useRef, useLayoutEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookmark } from "@fortawesome/free-solid-svg-icons";
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
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CollectionObject } from "./types";

interface CollectionObjectGridProps {
  objects: CollectionObject[];
  onImageClick: (url: string) => void;
  onRemoveObject: (uuid: string) => void;
  onReorder: (objectUuid: string, newPosition: number) => void;
  onFileDrop: (files: FileList) => void;
}

export function CollectionObjectGrid({
  objects,
  onImageClick,
  onRemoveObject,
  onReorder,
  onFileDrop,
}: CollectionObjectGridProps) {
  const [isDragOverContainer, setIsDragOverContainer] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = objects.findIndex(item => item.uuid === active.id);
        const newIndex = objects.findIndex(item => item.uuid === over.id);

        const object = objects[oldIndex];
        // Position is 1-indexed
        onReorder(object.uuid, newIndex + 1);
      }
    },
    [objects, onReorder]
  );

  // Container drag handlers for file drops
  const handleContainerDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Only show drag over state if there are files being dragged
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOverContainer(true);
    }
  }, []);

  const handleContainerDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only update if leaving the container (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsDragOverContainer(false);
    }
  }, []);

  const handleContainerDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOverContainer(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        onFileDrop(files);
      }
    },
    [onFileDrop]
  );

  return (
    <div
      className={`drag-target d-flex flex-wrap w-100 ${isDragOverContainer ? "collection-drag-over" : ""}`}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={objects.map(obj => obj.uuid)} strategy={rectSortingStrategy}>
          {objects.map(object => (
            <SortableCollectionItem
              key={object.uuid}
              object={object}
              onImageClick={onImageClick}
              onRemoveObject={onRemoveObject}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default CollectionObjectGrid;

interface SortableCollectionItemProps {
  object: CollectionObject;
  onImageClick: (url: string) => void;
  onRemoveObject: (uuid: string) => void;
}

function SortableCollectionItem({
  object,
  onImageClick,
  onRemoveObject,
}: SortableCollectionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: object.uuid,
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
      className={`slicklist-list-item-inner sortable-collection-grid-item h-100 ${isDragging ? "dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <li className="collection-item list-group-item hoverable cursor-pointer h-100 p-3">
        <button
          type="button"
          className="collection-item-delete btn-close"
          aria-label="Remove"
          onClick={e => {
            e.stopPropagation();
            onRemoveObject(object.uuid);
          }}
          onPointerDown={e => e.stopPropagation()}
        />
        <div className="zoom d-flex flex-column justify-content-center h-100">
          {object.type === "blob" ? (
            <div>
              <img
                src={object.cover_url}
                alt={object.name}
                onClick={() => onImageClick(object.cover_url_large)}
              />
            </div>
          ) : (
            <div>
              <FontAwesomeIcon icon={faBookmark} className="text-primary fa-4x mt-3" />
            </div>
          )}
          <div className="collection-item-name" title={object.name}>
            <a href={object.url} onPointerDown={e => e.stopPropagation()}>
              {object.name || "No Title"}
            </a>
          </div>
        </div>
      </li>
    </div>
  );
}
