import React from "react";
import { createRoot } from "react-dom/client";
import PasswordChangePage from "../react/prefs/PasswordChangePage";

const container = document.getElementById("react-root");
if (container) {
  const formAction = container.getAttribute("data-form-action") || "";
  const csrfToken = container.getAttribute("data-csrf-token") || "";
  const prefsUrl = container.getAttribute("data-prefs-url") || "";

  const root = createRoot(container);
  root.render(
    <PasswordChangePage
      formAction={formAction}
      csrfToken={csrfToken}
      prefsUrl={prefsUrl}
    />
  );
}
