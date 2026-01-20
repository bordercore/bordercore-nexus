import React, { useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookmark } from "@fortawesome/free-solid-svg-icons";
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
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragOverContainer, setIsDragOverContainer] = useState(false);

  // Drag and drop handlers for reordering
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
      setDraggingIndex(index);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (draggingIndex !== null) {
        setDragOverIndex(index);
      }
    },
    [draggingIndex]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
      e.preventDefault();

      // Check if it's a file drop
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        // This is a file drop, handled by container
        return;
      }

      // This is a reorder drop
      if (draggingIndex !== null && draggingIndex !== dropIndex) {
        const object = objects[draggingIndex];
        // Position is 1-indexed
        onReorder(object.uuid, dropIndex + 1);
      }
      setDraggingIndex(null);
      setDragOverIndex(null);
    },
    [draggingIndex, objects, onReorder]
  );

  // Container drag handlers for file drops
  const handleContainerDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      // Only show drag over state if there are files being dragged
      if (e.dataTransfer.types.includes("Files")) {
        setIsDragOverContainer(true);
      }
    },
    []
  );

  const handleContainerDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      // Only update if leaving the container (not entering a child)
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (!e.currentTarget.contains(relatedTarget)) {
        setIsDragOverContainer(false);
      }
    },
    []
  );

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
      {objects.map((object, index) => (
        <div
          key={object.uuid}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          className={`slicklist-list-item-inner h-100 ${
            draggingIndex === index ? "dragging" : ""
          } ${dragOverIndex === index ? "drag-over" : ""}`}
        >
          <li className="collection-item list-group-item hoverable cursor-pointer h-100 p-3">
            <button
              type="button"
              className="collection-item-delete btn-close"
              aria-label="Remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveObject(object.uuid);
              }}
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
                  <FontAwesomeIcon
                    icon={faBookmark}
                    className="text-primary fa-4x mt-3"
                  />
                </div>
              )}
              <div className="collection-item-name" title={object.name}>
                <a href={object.url}>{object.name || "No Title"}</a>
              </div>
            </div>
          </li>
        </div>
      ))}
    </div>
  );
}

export default CollectionObjectGrid;
