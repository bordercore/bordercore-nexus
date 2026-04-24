import React from "react";
import { createRoot } from "react-dom/client";
import ConstellationPage from "../react/visualize/ConstellationPage";

const container = document.getElementById("react-root");
if (container) {
  const graphUrl = container.getAttribute("data-graph-url") || "";

  if (graphUrl) {
    const root = createRoot(container);
    root.render(<ConstellationPage graphUrl={graphUrl} />);
  } else {
    console.error("ConstellationPage: missing data-graph-url");
  }
}
