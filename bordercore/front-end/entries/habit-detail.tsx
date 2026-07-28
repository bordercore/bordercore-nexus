import React from "react";
import { createRoot } from "react-dom/client";
import HabitDetailPage from "../react/habit/HabitDetailPage";
import type { HabitDetail } from "../react/habit/types";

const container = document.getElementById("react-root");
if (container) {
  const habitJson = container.getAttribute("data-habit") || "{}";
  const logUrl = container.getAttribute("data-log-url") || "";
  const setInactiveUrl = container.getAttribute("data-set-inactive-url") || "";
  const noteAddUrl = container.getAttribute("data-note-add-url") || "";
  const noteUpdateUrl = container.getAttribute("data-note-update-url") || "";
  const noteDeleteUrl = container.getAttribute("data-note-delete-url") || "";

  const fallback: HabitDetail = {
    uuid: "",
    name: "",
    purpose: "",
    start_date: "",
    end_date: null,
    is_active: false,
    tags: [],
    unit: "",
    current_streak: 0,
    longest_streak: 0,
    logs: [],
    notes: [],
  };

  let habit: HabitDetail = fallback;
  try {
    habit = JSON.parse(habitJson) as HabitDetail;
  } catch (e) {
    console.error("Error parsing habit:", e);
  }

  const root = createRoot(container);
  root.render(
    <HabitDetailPage
      habit={habit}
      logUrl={logUrl}
      setInactiveUrl={setInactiveUrl}
      noteAddUrl={noteAddUrl}
      noteUpdateUrl={noteUpdateUrl}
      noteDeleteUrl={noteDeleteUrl}
    />,
  );
}
