import React from "react";
import { createRoot } from "react-dom/client";
import ReminderDetailPage from "../react/reminder/ReminderDetailPage";

// Get URLs from data attributes or BASE_TEMPLATE_DATA
const container = document.getElementById("react-root");
if (container) {
  // Try to get URLs from data attributes first
  const detailAjaxUrl = container.getAttribute("data-detail-ajax-url") || "";

  // Fallback to BASE_TEMPLATE_DATA if available
  const data = (window as any).BASE_TEMPLATE_DATA || {};
  const finalDetailAjaxUrl = detailAjaxUrl || data.reminderDetailAjaxUrl || "";

  if (finalDetailAjaxUrl) {
    const root = createRoot(container);
    root.render(<ReminderDetailPage detailAjaxUrl={finalDetailAjaxUrl} />);
  } else {
    console.error("ReminderDetailPage: Missing required URL. detailAjaxUrl:", finalDetailAjaxUrl);
  }
}

