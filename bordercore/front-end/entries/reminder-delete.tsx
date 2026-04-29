import React from "react";
import { createRoot } from "react-dom/client";
import ReminderDeletePage from "../react/reminder/ReminderDeletePage";

// Get URLs and data from data attributes or BASE_TEMPLATE_DATA
const container = document.getElementById("react-root");
if (container) {
  // Try to get data from data attributes first
  const reminderName = container.getAttribute("data-reminder-name") || "";
  const deleteUrl = container.getAttribute("data-delete-url") || "";
  const cancelUrl = container.getAttribute("data-cancel-url") || "";

  if (reminderName && deleteUrl && cancelUrl) {
    const root = createRoot(container);
    root.render(
      <ReminderDeletePage
        reminderName={reminderName}
        deleteUrl={deleteUrl}
        cancelUrl={cancelUrl}
      />
    );
  } else {
    console.error(
      "ReminderDeletePage: Missing required data.",
      "reminderName:",
      reminderName ? "present" : "missing",
      "deleteUrl:",
      deleteUrl ? "present" : "missing",
      "cancelUrl:",
      cancelUrl ? "present" : "missing"
    );
  }
}

