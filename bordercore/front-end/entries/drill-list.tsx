import React from "react";
import { createRoot } from "react-dom/client";
import DrillOverviewPage from "../react/drill/DrillOverviewPage";
import type { DrillPayload } from "../react/drill/types";

const container = document.getElementById("drill-overview-root");
const payloadEl = document.getElementById("drill-overview-payload");

if (!container) {
  console.error("drill-overview-root container missing");
} else if (!payloadEl?.textContent) {
  console.error("drill-overview-payload script tag is missing or empty");
} else {
  const payload: DrillPayload = JSON.parse(payloadEl.textContent);
  createRoot(container).render(<DrillOverviewPage payload={payload} />);
}
