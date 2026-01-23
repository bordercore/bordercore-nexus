import React from "react";
import { createRoot } from "react-dom/client";
import SqlPlaygroundPage from "../react/homepage/SqlPlaygroundPage";

const container = document.getElementById("react-root");
if (container) {
  // Get optional SQL database URL from data attribute
  const sqlDbUrl = container.getAttribute("data-sql-db-url") || undefined;

  const root = createRoot(container);
  root.render(<SqlPlaygroundPage sqlDbUrl={sqlDbUrl} />);
}
