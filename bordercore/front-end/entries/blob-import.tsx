import React from "react";
import { createRoot } from "react-dom/client";
import BlobImportPage from "../react/blob/BlobImportPage";

interface Message {
  body: string;
  variant: string;
  autoHide: boolean;
}

const container = document.getElementById("react-root");

if (container) {
  const messagesEl = document.getElementById("messages-data");
  const messages: Message[] = messagesEl
    ? JSON.parse(messagesEl.textContent || "[]")
    : [];

  const root = createRoot(container);
  root.render(
    <BlobImportPage
      staticUrl={container.dataset.staticUrl || ""}
      importUrl={container.dataset.importUrl || ""}
      csrfToken={container.dataset.csrfToken || ""}
      messages={messages}
      initialUrl={container.dataset.initialUrl || ""}
    />
  );
}
