import { useState, useEffect, useCallback } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { doGet, doPost } from "../../utils/reactUtils";
import type { RelatedObject, UseRelatedObjectsConfig } from "./types";

export interface UseRelatedObjects {
  items: RelatedObject[];
  loading: boolean;
  refresh: () => void;
  addObject: (uuid: string) => Promise<void>;
  removeObject: (item: RelatedObject) => void;
  reorder: (activeUuid: string, overUuid: string) => void;
  editNote: (item: RelatedObject, note: string) => void;
}

/**
 * Owns the related-objects list and all its persistence for a single node
 * (a drill question or a blob). Network I/O is confined to this hook; the
 * card component is purely presentational.
 */
export function useRelatedObjects({
  objectUuid,
  nodeType,
  urls,
}: UseRelatedObjectsConfig): UseRelatedObjects {
  const [items, setItems] = useState<RelatedObject[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    doGet(
      urls.relatedObjects,
      (response: any) => {
        setItems(response.data.related_objects || []);
        setLoading(false);
      },
      "Error getting related objects"
    );
  }, [urls.relatedObjects]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addObject = useCallback(
    (uuid: string) =>
      new Promise<void>(resolve => {
        doPost(urls.add, { node_uuid: objectUuid, object_uuid: uuid, node_type: nodeType }, () => {
          refresh();
          resolve();
        });
      }),
    [urls.add, objectUuid, nodeType, refresh]
  );

  const removeObject = useCallback(
    (item: RelatedObject) => {
      doPost(
        urls.remove,
        { node_uuid: objectUuid, object_uuid: item.uuid, node_type: nodeType },
        () => refresh()
      );
    },
    [urls.remove, objectUuid, nodeType, refresh]
  );

  const reorder = useCallback(
    (activeUuid: string, overUuid: string) => {
      setItems(prev => {
        const oldIndex = prev.findIndex(i => i.uuid === activeUuid);
        const newIndex = prev.findIndex(i => i.uuid === overUuid);
        if (oldIndex === -1 || newIndex === -1) return prev;

        doPost(
          urls.sort,
          {
            node_uuid: objectUuid,
            object_uuid: activeUuid,
            new_position: newIndex + 1,
            node_type: nodeType,
          },
          () => {}
        );
        return arrayMove(prev, oldIndex, newIndex);
      });
    },
    [urls.sort, objectUuid, nodeType]
  );

  const editNote = useCallback(
    (item: RelatedObject, note: string) => {
      if (note === item.note) return;
      doPost(
        urls.editNote,
        {
          node_uuid: objectUuid,
          object_uuid: item.uuid,
          note,
          node_type: nodeType,
        },
        () => refresh()
      );
    },
    [urls.editNote, objectUuid, nodeType, refresh]
  );

  return { items, loading, refresh, addObject, removeObject, reorder, editNote };
}

export default useRelatedObjects;
