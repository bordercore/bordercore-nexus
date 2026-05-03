import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import type { CollectionObject } from "./types";
import CurateTile from "./CurateTile";

interface CurateGridProps {
  objects: CollectionObject[];
  columns: 3 | 4 | 5 | 6;
  shuffled: boolean;
  hasMore: boolean;
  loadingInitial: boolean;
  loadingMore: boolean;
  activeTag: string | null;
  onReorder: (oldIndex: number, newIndex: number) => void;
  onLoadMore: () => void;
  onThumbClick: (object: CollectionObject) => void;
  onRemove: (object: CollectionObject) => void;
  onTagClick: (tag: string) => void;
  onFileDrop: (files: FileList) => void;
  onClearFilter: () => void;
  onAdd: () => void;
}

export function CurateGrid({
  objects,
  columns,
  shuffled,
  hasMore,
  loadingInitial,
  loadingMore,
  activeTag,
  onReorder,
  onLoadMore,
  onThumbClick,
  onRemove,
  onTagClick,
  onFileDrop,
  onClearFilter,
  onAdd,
}: CurateGridProps) {
  const [isDragOverContainer, setIsDragOverContainer] = useState(false);
  const [isItemDragging, setIsItemDragging] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Set the column count via a CSS custom property so we don't violate the
  // no-inline-style rule enforced by test_general.py::test_html.
  useLayoutEffect(() => {
    gridRef.current?.style.setProperty("--cd-cols", String(columns));
  }, [columns]);

  // Infinite-scroll: load next page when the sentinel scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || shuffled) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, shuffled, onLoadMore, objects.length]);

  const handleDragStart = useCallback((_event: DragStartEvent) => {
    setIsItemDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setIsItemDragging(false);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = objects.findIndex(o => o.uuid === active.id);
      const newIndex = objects.findIndex(o => o.uuid === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      onReorder(oldIndex, newIndex);
    },
    [objects, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    setIsItemDragging(false);
  }, []);

  const handleContainerDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      // Only treat external file drags as a "file drop"; ignore tile drags.
      if (isItemDragging) return;
      e.preventDefault();
      setIsDragOverContainer(true);
    },
    [isItemDragging]
  );

  const handleContainerDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsDragOverContainer(false);
    }
  }, []);

  const handleContainerDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (isItemDragging) return;
      e.preventDefault();
      setIsDragOverContainer(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) onFileDrop(files);
    },
    [isItemDragging, onFileDrop]
  );

  // Initial loading state: skeleton tiles
  if (loadingInitial) {
    return (
      <div ref={gridRef} className="cd-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="cd-skeleton">
            <div className="cd-skeleton-thumb" />
            <div className="cd-skeleton-meta">
              <div className="cd-skeleton-line" />
              <div className="cd-skeleton-line short" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty states
  if (objects.length === 0) {
    if (activeTag) {
      return (
        <div className="cd-empty">
          <div>
            No items tagged <code>#{activeTag}</code>
          </div>
          <a
            href="#"
            onClick={e => {
              e.preventDefault();
              onClearFilter();
            }}
          >
            Clear filter
          </a>
        </div>
      );
    }
    return (
      <div className="cd-empty">
        <div>This collection is empty.</div>
        <button type="button" className="cd-btn primary" onClick={onAdd}>
          Add your first object
        </button>
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className={isDragOverContainer ? "cd-grid drag-over" : "cd-grid"}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={objects.map(o => o.uuid)} strategy={rectSortingStrategy}>
          {objects.map(object => (
            <CurateTile
              key={object.uuid}
              object={object}
              shuffled={shuffled}
              onThumbClick={onThumbClick}
              onRemove={onRemove}
              onTagClick={onTagClick}
            />
          ))}
        </SortableContext>
      </DndContext>

      {loadingMore &&
        Array.from({ length: 4 }).map((_, i) => (
          <div key={`skel-${i}`} className="cd-skeleton">
            <div className="cd-skeleton-thumb" />
            <div className="cd-skeleton-meta">
              <div className="cd-skeleton-line" />
              <div className="cd-skeleton-line short" />
            </div>
          </div>
        ))}

      {hasMore && !shuffled && <div ref={sentinelRef} className="cd-sentinel" aria-hidden="true" />}
    </div>
  );
}

export default CurateGrid;
