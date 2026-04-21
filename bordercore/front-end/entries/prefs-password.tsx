import React from "react";
import { createRoot } from "react-dom/client";
import PasswordChangePage from "../react/prefs/PasswordChangePage";

const container = document.getElementById("react-root");
if (container) {
  const formAction = container.getAttribute("data-form-action") || "";
  const csrfToken = container.getAttribute("data-csrf-token") || "";
  const prefsUrl = container.getAttribute("data-prefs-url") || "";
  const passwordUrl = container.getAttribute("data-password-url") || formAction;
  const username = container.getAttribute("data-username") || "";
  const sessionsUrl = container.getAttribute("data-sessions-url") || "";
  const sessionsRevokeUrlTemplate =
    container.getAttribute("data-sessions-revoke-url-template") || "";

  const root = createRoot(container);
  root.render(
    <PasswordChangePage
      formAction={formAction}
      csrfToken={csrfToken}
      prefsUrl={prefsUrl}
      passwordUrl={passwordUrl}
      username={username}
      sessionsUrl={sessionsUrl}
      sessionsRevokeUrlTemplate={sessionsRevokeUrlTemplate}
    />
  );
}
