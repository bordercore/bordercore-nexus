import React from "react";
import { createRoot } from "react-dom/client";
import ReminderFormPage from "../react/reminder/ReminderFormPage";

// Get URLs and data from data attributes or BASE_TEMPLATE_DATA
const container = document.getElementById("react-root");
if (container) {
  // Try to get URLs from data attributes first
  const formAjaxUrl = container.getAttribute("data-form-ajax-url") || "";
  const submitUrl = container.getAttribute("data-submit-url") || "";
  const cancelUrl = container.getAttribute("data-cancel-url") || "";
  const isEdit = container.getAttribute("data-is-edit") === "true";

  // Fallback to BASE_TEMPLATE_DATA if available
  const data = (window as any).BASE_TEMPLATE_DATA || {};
  const finalFormAjaxUrl = formAjaxUrl || data.reminderFormAjaxUrl || "";
  const finalSubmitUrl = submitUrl || data.reminderSubmitUrl || "";
  const finalCancelUrl = cancelUrl || data.reminderCancelUrl || "";
  const finalCsrfToken = data.csrfToken || "";

  if (finalSubmitUrl && finalCancelUrl && finalCsrfToken) {
    const root = createRoot(container);
    root.render(
      <ReminderFormPage
        formAjaxUrl={finalFormAjaxUrl}
        submitUrl={finalSubmitUrl}
        cancelUrl={finalCancelUrl}
        isEdit={isEdit}
        csrfToken={finalCsrfToken}
      />
    );
  } else {
    console.error(
      "ReminderFormPage: Missing required URLs or CSRF token.",
      "submitUrl:",
      finalSubmitUrl,
      "cancelUrl:",
      finalCancelUrl,
      "csrfToken:",
      finalCsrfToken ? "present" : "missing"
    );
  }
}

