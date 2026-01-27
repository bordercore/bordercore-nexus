import React from "react";
import { createRoot } from "react-dom/client";
import NodeListPage from "../react/node/NodeListPage";
import type { NodeListItem, FormField } from "../react/node/types";

const container = document.getElementById("react-root");
if (container) {
  // Get URLs from data attributes
  const createUrl = container.getAttribute("data-create-url") || "";

  // Parse JSON data from json_script tags
  const nodeListEl = document.getElementById("node-list-data");
  let nodeList: NodeListItem[] = [];
  try {
    nodeList = nodeListEl ? JSON.parse(nodeListEl.textContent || "[]") : [];
  } catch (e) {
    console.error("Error parsing node list:", e);
  }

  const formFieldsEl = document.getElementById("form-fields-data");
  let formFields: FormField[] = [];
  try {
    formFields = formFieldsEl ? JSON.parse(formFieldsEl.textContent || "[]") : [];
  } catch (e) {
    console.error("Error parsing form fields:", e);
  }

  const root = createRoot(container);
  root.render(
    <NodeListPage
      nodes={nodeList}
      createUrl={createUrl}
      formFields={formFields}
    />
  );
}
