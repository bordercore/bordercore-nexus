import React from "react";
import { createRoot } from "react-dom/client";
import HabitListPage from "../react/habit/HabitListPage";

const container = document.getElementById("react-root");
if (container) {
  const habitsJson = container.getAttribute("data-habits") || "[]";
  const logUrl = container.getAttribute("data-log-url") || "";
  const createUrl = container.getAttribute("data-create-url") || "";
  const detailUrlTemplate = container.getAttribute("data-detail-url-template") || "";

  let habits = [];
  try {
    habits = JSON.parse(habitsJson);
  } catch (e) {
    console.error("Error parsing habits:", e);
  }

  const root = createRoot(container);
  root.render(
    <HabitListPage habits={habits} logUrl={logUrl} createUrl={createUrl} detailUrlTemplate={detailUrlTemplate} />
  );
}
