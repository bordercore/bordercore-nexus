import React from "react";
import { createRoot } from "react-dom/client";
import BlobDetailPage from "../react/blob/BlobDetailPage";
import type {
  BlobDetail,
  BlobDetailUrls,
  Collection,
  ElasticsearchInfo,
  BackReference,
  TreeData,
  NodeInfo,
} from "../react/blob/types";

const container = document.getElementById("react-root");
if (container) {
  // Parse JSON data from script tags
  const parseJsonScript = <T,>(id: string, defaultValue: T): T => {
    const script = document.getElementById(id);
    if (script) {
      try {
        return JSON.parse(script.textContent || "null") ?? defaultValue;
      } catch (e) {
        console.error(`Error parsing ${id}:`, e);
      }
    }
    return defaultValue;
  };

  const blob: BlobDetail = parseJsonScript("blob-data", {
    uuid: "",
    name: "",
    isNote: false,
    isVideo: false,
    isImage: false,
    isPdf: false,
    mathSupport: false,
    hasBeenModified: false,
    tags: [],
  });

  const urls: BlobDetailUrls = parseJsonScript("urls-data", {
    edit: "",
    clone: "",
    create: "",
    list: "",
    delete: "",
    getElasticsearchInfo: "",
    relatedObjects: "",
    addRelatedObject: "",
    removeRelatedObject: "",
    sortRelatedObjects: "",
    editRelatedObjectNote: "",
    collectionSearch: "",
    addToCollection: "",
    createCollection: "",
    pinNote: "",
    searchNames: "",
    kbSearchTagDetail: "",
  });

  const blobUrls: Array<{ url: string; domain: string }> = parseJsonScript("blob-urls", []);
  const initialCollectionList: Collection[] = parseJsonScript("collection-list", []);
  const initialElasticsearchInfo: ElasticsearchInfo | null = parseJsonScript(
    "elasticsearch-info",
    null
  );
  const backReferences: BackReference[] = parseJsonScript("back-references", []);
  const tree: TreeData = parseJsonScript("tree-data", { label: "Root", nodes: [] });
  const metadataMisc: Record<string, string> = parseJsonScript("metadata-misc", {});
  const nodeList: NodeInfo[] = parseJsonScript("node-list", []);

  // Read data attributes
  const isPinnedNote = container.getAttribute("data-is-pinned-note") === "true";
  const isAdmin = container.getAttribute("data-is-admin") === "true";
  const showMetadata = container.getAttribute("data-show-metadata") === "true";
  const mediaUrl = container.getAttribute("data-media-url") || "";

  const root = createRoot(container);
  root.render(
    <BlobDetailPage
      blob={blob}
      urls={urls}
      blobUrls={blobUrls}
      initialCollectionList={initialCollectionList}
      initialElasticsearchInfo={initialElasticsearchInfo}
      backReferences={backReferences}
      tree={tree}
      metadataMisc={metadataMisc}
      nodeList={nodeList}
      isPinnedNote={isPinnedNote}
      isAdmin={isAdmin}
      showMetadata={showMetadata}
      mediaUrl={mediaUrl}
    />
  );
}
