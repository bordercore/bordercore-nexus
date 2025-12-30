import React from "react";
import { createRoot } from "react-dom/client";
import RemindersPage from "../react/reminder/RemindersPage";

// Get URLs from data attributes or BASE_TEMPLATE_DATA
const container = document.getElementById("react-root");
if (container) {
  // Try to get URLs from data attributes first
  const listAjaxUrl = container.getAttribute("data-list-ajax-url") || "";
  const createUrl = container.getAttribute("data-create-url") || "";

  // Fallback to BASE_TEMPLATE_DATA if available
  const data = (window as any).BASE_TEMPLATE_DATA || {};
  const finalListAjaxUrl = listAjaxUrl || data.reminderListAjaxUrl || "";
  const finalCreateUrl = createUrl || data.reminderCreateUrl || "";

  if (finalListAjaxUrl && finalCreateUrl) {
    const root = createRoot(container);
    root.render(<RemindersPage listAjaxUrl={finalListAjaxUrl} createUrl={finalCreateUrl} />);
  } else {
    console.error("RemindersPage: Missing required URLs. listAjaxUrl:", finalListAjaxUrl, "createUrl:", finalCreateUrl);
  }
}

