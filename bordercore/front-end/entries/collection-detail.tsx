import React from "react";
import { createRoot } from "react-dom/client";
import CollectionDetailPage from "../react/collection/CollectionDetailPage";
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

  const csrfToken = container.dataset.csrfToken || "";
  const tagSearchUrl = container.dataset.tagSearchUrl || "";

  const root = createRoot(container);
  root.render(
    <CollectionDetailPage
      collection={collection}
      objectTags={objectTags}
      initialTags={initialTags}
      urls={urls}
      csrfToken={csrfToken}
      tagSearchUrl={tagSearchUrl}
      selectedTag={selectedTag}
    />
  );
}
