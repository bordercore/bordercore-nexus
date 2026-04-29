import React from "react";
import { createRoot } from "react-dom/client";
import BookmarkEditPage from "../react/bookmark/BookmarkEditPage";
import type { BackReference, RelatedNode } from "../react/bookmark/types";

interface FormField {
  name: string;
  label: string;
  value: string;
  type: "text" | "url" | "textarea" | "hidden";
  required?: boolean;
  errors?: string[];
}

const container = document.getElementById("react-root");
if (container) {
  const tagSearchUrl = container.getAttribute("data-tag-search-url") || "";
  const relatedTagsUrl = container.getAttribute("data-related-tags-url") || "";
  const deleteBookmarkUrl = container.getAttribute("data-delete-bookmark-url") || "";
  const bookmarkOverviewUrl = container.getAttribute("data-bookmark-overview-url") || "";

  const uuid = container.getAttribute("data-uuid") || "";
  const formAction = container.getAttribute("data-form-action") || "";
  const thumbnailUrl = container.getAttribute("data-thumbnail-url") || undefined;
  const faviconImgUrl = container.getAttribute("data-favicon-img-url") || undefined;
  const bookmarkName = container.getAttribute("data-bookmark-name") || "";

  const initialImportance = container.getAttribute("data-initial-importance") === "true";
  const initialIsPinned = container.getAttribute("data-initial-is-pinned") === "true";
  const initialDaily = parseInt(container.getAttribute("data-initial-daily") || "0", 10);

  const created = container.getAttribute("data-created") || "";
  const modified = container.getAttribute("data-modified") || "";
  const lastCheck = container.getAttribute("data-last-check") || null;
  const lastResponseCodeAttr = container.getAttribute("data-last-response-code");
  const lastResponseCode =
    lastResponseCodeAttr && lastResponseCodeAttr !== ""
      ? parseInt(lastResponseCodeAttr, 10)
      : null;

  let fields: FormField[] = [];
  const fieldsScript = document.getElementById("formFields");
  if (fieldsScript) {
    try {
      fields = JSON.parse(fieldsScript.textContent || "[]");
    } catch (e) {
      console.error("Error parsing form fields:", e);
    }
  }

  let initialTags: string[] = [];
  const tagsScript = document.getElementById("initial-tags");
  if (tagsScript) {
    try {
      const parsed = JSON.parse(tagsScript.textContent || "[]");
      initialTags = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Error parsing initial tags:", e);
    }
  }

  let backReferences: BackReference[] = [];
  const backRefsScript = document.getElementById("backReferences");
  if (backRefsScript) {
    try {
      backReferences = JSON.parse(backRefsScript.textContent || "[]");
    } catch (e) {
      console.error("Error parsing back references:", e);
    }
  }

  let relatedNodes: RelatedNode[] = [];
  const relatedNodesScript = document.getElementById("related_nodes");
  if (relatedNodesScript) {
    try {
      relatedNodes = JSON.parse(relatedNodesScript.textContent || "[]");
    } catch (e) {
      console.error("Error parsing related nodes:", e);
    }
  }

  const root = createRoot(container);
  root.render(
    <BookmarkEditPage
      uuid={uuid}
      formAction={formAction}
      thumbnailUrl={thumbnailUrl}
      faviconImgUrl={faviconImgUrl}
      bookmarkName={bookmarkName}
      fields={fields}
      initialTags={initialTags}
      initialImportance={initialImportance}
      initialIsPinned={initialIsPinned}
      initialDaily={initialDaily}
      created={created}
      modified={modified}
      lastCheck={lastCheck}
      lastResponseCode={lastResponseCode}
      backReferences={backReferences}
      relatedNodes={relatedNodes}
      urls={{
        tagSearch: tagSearchUrl,
        relatedTags: relatedTagsUrl,
        deleteBookmark: deleteBookmarkUrl,
        bookmarkOverview: bookmarkOverviewUrl,
      }}
    />
  );
}
