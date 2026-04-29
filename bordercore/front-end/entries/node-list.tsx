import React from "react";
import { createRoot } from "react-dom/client";
import NodeListPage from "../react/node/NodeListPage";
import type { NodeListItem } from "../react/node/types";

const container = document.getElementById("react-root");
if (container) {
  const createUrl = container.getAttribute("data-create-url") || "";
  const detailUrl = container.getAttribute("data-detail-url") || "";

  const nodeListEl = document.getElementById("node-list-data");
  let nodeList: NodeListItem[] = [];
  try {
    nodeList = nodeListEl ? JSON.parse(nodeListEl.textContent || "[]") : [];
  } catch (e) {
    console.error("Error parsing node list:", e);
  }

  const root = createRoot(container);
  root.render(
    <NodeListPage
      nodes={nodeList}
      createUrl={createUrl}
      detailUrl={detailUrl}
    />
  );
}
