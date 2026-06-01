import React, { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import ObjectSelectModal from "../ObjectSelectModal";
import { RelatedObjectsCard } from "./RelatedObjectsCard";
import { useRelatedObjects } from "./useRelatedObjects";
import type { NodeType, RelatedObjectUrls } from "./types";

export interface RelatedObjectsHandle {
  /** Open the add modal from outside the card (e.g. a page topbar button). */
  openAddModal: () => void;
}

interface RelatedObjectsHeaderApi {
  /** Open the "select object" modal to add a relationship. */
  openAddModal: () => void;
  /** Current number of related objects. */
  count: number;
}

export interface RelatedObjectsProps {
  objectUuid: string;
  nodeType: NodeType;
  urls: RelatedObjectUrls & { searchNames: string };
  /**
   * Page-native heading chrome. Receives `openAddModal` to wire the page's own
   * add button, and `count` for an optional badge. Rendered above the list.
   */
  header: (api: RelatedObjectsHeaderApi) => React.ReactNode;
  /**
   * Class for the outer wrapper, so each page supplies its own surface chrome.
   * May be a function of the item count (e.g. to toggle an "is-empty" modifier).
   */
  className?: string | ((count: number) => string);
  modalTitle?: string;
  showEmptyState?: boolean;
}

/**
 * The unified related-objects card: owns data (useRelatedObjects), the list
 * (RelatedObjectsCard), and the add modal (ObjectSelectModal). Each page passes
 * its own heading chrome via `header` so the card matches its surroundings while
 * sharing all behavior.
 */
export const RelatedObjects = forwardRef<RelatedObjectsHandle, RelatedObjectsProps>(
  function RelatedObjects(
    {
      objectUuid,
      nodeType,
      urls,
      header,
      className,
      modalTitle = "Select object",
      showEmptyState = true,
    },
    ref
  ) {
    const ro = useRelatedObjects({ objectUuid, nodeType, urls });
    const [modalOpen, setModalOpen] = useState(false);

    const openAddModal = useCallback(() => setModalOpen(true), []);

    useImperativeHandle(ref, () => ({ openAddModal }), [openAddModal]);

    const handleSelect = useCallback(
      (selected: { uuid: string }) => {
        ro.addObject(selected.uuid).then(() => setModalOpen(false));
      },
      [ro]
    );

    const wrapperClassName =
      typeof className === "function" ? className(ro.items.length) : className;

    return (
      <div className={wrapperClassName}>
        {header({ openAddModal, count: ro.items.length })}
        <RelatedObjectsCard
          items={ro.items}
          loading={ro.loading}
          onRemove={ro.removeObject}
          onReorder={ro.reorder}
          onEditNote={ro.editNote}
          showEmptyState={showEmptyState}
        />
        <ObjectSelectModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={modalTitle}
          searchObjectUrl={urls.searchNames}
          onSelectObject={handleSelect}
        />
      </div>
    );
  }
);

export default RelatedObjects;
