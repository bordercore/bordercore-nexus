import React from "react";
import { createRoot } from "react-dom/client";
import BookmarkFormPage from "../react/bookmark/BookmarkFormPage";
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
  // Get URLs from data attributes
  const tagSearchUrl = container.getAttribute("data-tag-search-url") || "";
  const relatedTagsUrl = container.getAttribute("data-related-tags-url") || "";
  const getTitleFromUrlUrl =
    container.getAttribute("data-get-title-from-url-url") || "";
  const deleteBookmarkUrl =
    container.getAttribute("data-delete-bookmark-url") || "";
  const bookmarkOverviewUrl =
    container.getAttribute("data-bookmark-overview-url") || "";

  // Get form data from data attributes
  const uuid = container.getAttribute("data-uuid") || undefined;
  const action = (container.getAttribute("data-action") || "Create") as
    | "Create"
    | "Update";
  const formAction = container.getAttribute("data-form-action") || "";
  const csrfToken = container.getAttribute("data-csrf-token") || "";
  const thumbnailUrl = container.getAttribute("data-thumbnail-url") || undefined;
  const faviconHtml = container.getAttribute("data-favicon-html") || undefined;
  const bookmarkName = container.getAttribute("data-bookmark-name") || undefined;

  // Parse initial boolean values
  const initialImportance =
    container.getAttribute("data-initial-importance") === "true";
  const initialIsPinned =
    container.getAttribute("data-initial-is-pinned") === "true";
  const initialDaily = parseInt(
    container.getAttribute("data-initial-daily") || "0",
    10
  );

  // Parse JSON data from script tags
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
    <BookmarkFormPage
      uuid={uuid}
      action={action}
      formAction={formAction}
      csrfToken={csrfToken}
      thumbnailUrl={thumbnailUrl}
      faviconHtml={faviconHtml}
      bookmarkName={bookmarkName}
      fields={fields}
      initialTags={initialTags}
      initialImportance={initialImportance}
      initialIsPinned={initialIsPinned}
      initialDaily={initialDaily}
      backReferences={backReferences}
      relatedNodes={relatedNodes}
      urls={{
        tagSearch: tagSearchUrl,
        relatedTags: relatedTagsUrl,
        getTitleFromUrl: getTitleFromUrlUrl,
        deleteBookmark: deleteBookmarkUrl,
        bookmarkOverview: bookmarkOverviewUrl,
      }}
    />
  );
}
