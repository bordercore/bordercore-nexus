import React from "react";
import { createRoot } from "react-dom/client";
import CurateCollectionPage from "../react/collection/CurateCollectionPage";
import type { CollectionDetail, ObjectTag, CollectionDetailUrls } from "../react/collection/types";

const container = document.getElementById("react-root");

if (container) {
  // Read JSON data from script tags (Django's json_script filter)
  const collectionDataEl = document.getElementById("collection-data");
  const objectTagsEl = document.getElementById("object-tags-data");
  const initialTagsEl = document.getElementById("initial-tags-data");

  const collection: CollectionDetail = collectionDataEl
    ? JSON.parse(collectionDataEl.textContent || "{}")
    : {} as CollectionDetail;
  const objectTags: ObjectTag[] = objectTagsEl
    ? JSON.parse(objectTagsEl.textContent || "[]")
    : [];
  const initialTags: string[] = initialTagsEl
    ? JSON.parse(initialTagsEl.textContent || "[]")
    : [];

  const selectedTag: string | null = container.dataset.selectedTag || null;

  const urls: CollectionDetailUrls = {
    getObjectList: container.dataset.getObjectListUrl || "",
    sortObjects: container.dataset.sortObjectsUrl || "",
    removeObject: container.dataset.removeObjectUrl || "",
    updateCollection: container.dataset.updateCollectionUrl || "",
    deleteCollection: container.dataset.deleteCollectionUrl || "",
    createBlob: container.dataset.createBlobUrl || "",
    getBlob: container.dataset.getBlobUrl || "",
    collectionList: container.dataset.collectionListUrl || "",
    blobDetail: container.dataset.blobDetailUrl || "",
  };

  const tagSearchUrl = container.dataset.tagSearchUrl || "";

  const root = createRoot(container);
  root.render(
    <CurateCollectionPage
      collection={collection}
      objectTags={objectTags}
      initialTags={initialTags}
      urls={urls}
      tagSearchUrl={tagSearchUrl}
      selectedTag={selectedTag}
    />
  );
}
