import React from "react";
import { createRoot } from "react-dom/client";
import FitnessSummaryPage from "../react/fitness/summary/FitnessSummaryPage";
import type { SummaryPayload } from "../react/fitness/summary/types";

const EMPTY: SummaryPayload = {
  today_dow: 0,
  groups: [],
  exercises: [],
};

const container = document.getElementById("react-root");
if (container) {
  const raw = container.getAttribute("data-summary") || "";
  let payload: SummaryPayload = EMPTY;
  try {
    payload = raw ? (JSON.parse(raw) as SummaryPayload) : EMPTY;
  } catch (e) {
    console.error("Error parsing fitness summary payload:", e);
  }

  createRoot(container).render(<FitnessSummaryPage payload={payload} />);
}
