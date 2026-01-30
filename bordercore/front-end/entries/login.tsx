import React from "react";
import { createRoot } from "react-dom/client";
import { LoginPage } from "../react/accounts/LoginPage";

document.addEventListener("DOMContentLoaded", () => {
  const rootElement = document.getElementById("react-root");
  if (!rootElement) return;

  const props = {
    message: rootElement.dataset.message || "",
    initialUsername: rootElement.dataset.initialUsername || "",
    loginUrl: rootElement.dataset.loginUrl || "",
    nextUrl: rootElement.dataset.nextUrl || "/",
    csrfToken: rootElement.dataset.csrfToken || "",
  };

  const root = createRoot(rootElement);
  root.render(<LoginPage {...props} />);
});
