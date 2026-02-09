import React from "react";
import { createRoot } from "react-dom/client";
import { DrillQuestionEditPage } from "../react/drill/DrillQuestionEditPage";

document.addEventListener("DOMContentLoaded", () => {
  const rootElement = document.getElementById("react-root");
  if (!rootElement) return;

  // Parse initial tags from JSON script
  const initialTagsEl = document.getElementById("initial-tags");
  let initialTags: string[] = initialTagsEl
    ? JSON.parse(initialTagsEl.textContent || "[]")
    : [];

  if (!Array.isArray(initialTags)) {
    initialTags = [];
  }

  // Parse recent tags from JSON script
  const recentTagsEl = document.getElementById("recent-tags");
  const recentTags = recentTagsEl
    ? JSON.parse(recentTagsEl.textContent || "[]")
    : [];

  // Parse errors from JSON script
  const errorsEl = document.getElementById("form-errors");
  const errors = errorsEl
    ? JSON.parse(errorsEl.textContent || "{}")
    : {};

  const objectUuid = rootElement.dataset.objectUuid || undefined;
  const placeholderUuid = "00000000-0000-0000-0000-000000000000";

  const props = {
    initialQuestion: rootElement.dataset.initialQuestion || "",
    initialAnswer: rootElement.dataset.initialAnswer || "",
    initialTags,
    initialIsReversible: rootElement.dataset.isReversible === "true",
    objectUuid,
    action: (rootElement.dataset.action || "Add") as "Add" | "Edit",
    recentTags,
    errors,
    urls: {
      submit: rootElement.dataset.submitUrl || "",
      delete: rootElement.dataset.deleteUrl || undefined,
      cancel: rootElement.dataset.cancelUrl || "",
      tagSearch: rootElement.dataset.tagSearchUrl || "",
      relatedObjects: objectUuid
        ? (rootElement.dataset.relatedObjectsUrl || "").replace(placeholderUuid, objectUuid)
        : "",
      newObject: rootElement.dataset.newObjectUrl || "",
      removeObject: rootElement.dataset.removeObjectUrl || "",
      sortRelatedObjects: rootElement.dataset.sortRelatedObjectsUrl || "",
      editRelatedObjectNote: rootElement.dataset.editRelatedObjectNoteUrl || "",
      searchNames: rootElement.dataset.searchNamesUrl || "",
    },
    csrfToken: rootElement.dataset.csrfToken || "",
    returnUrl: rootElement.dataset.returnUrl || "",
  };

  const root = createRoot(rootElement);
  root.render(<DrillQuestionEditPage {...props} />);
});
