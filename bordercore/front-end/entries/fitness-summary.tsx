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
  const inactiveDetailsUrl = container.getAttribute("data-inactive-details-url") || "";

  const payloadEl = document.getElementById("fitness-summary-data");
  let payload: SummaryPayload = EMPTY;
  try {
    payload = payloadEl ? (JSON.parse(payloadEl.textContent || "null") as SummaryPayload) : EMPTY;
  } catch (e) {
    console.error("Error parsing fitness summary payload:", e);
  }

  createRoot(container).render(
    <FitnessSummaryPage payload={payload ?? EMPTY} inactiveDetailsUrl={inactiveDetailsUrl} />
  );
}
