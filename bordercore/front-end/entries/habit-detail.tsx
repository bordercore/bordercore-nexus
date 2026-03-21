import React from "react";
import { createRoot } from "react-dom/client";
import HabitDetailPage from "../react/habit/HabitDetailPage";

const container = document.getElementById("react-root");
if (container) {
  const habitJson = container.getAttribute("data-habit") || "{}";
  const logUrl = container.getAttribute("data-log-url") || "";
  const setInactiveUrl = container.getAttribute("data-set-inactive-url") || "";
  const listUrl = container.getAttribute("data-list-url") || "";

  let habit = { uuid: "", name: "", purpose: "", start_date: "", end_date: null, is_active: false, tags: [], logs: [] };
  try {
    habit = JSON.parse(habitJson);
  } catch (e) {
    console.error("Error parsing habit:", e);
  }

  const root = createRoot(container);
  root.render(
    <HabitDetailPage habit={habit} logUrl={logUrl} setInactiveUrl={setInactiveUrl} listUrl={listUrl} />
  );
}
