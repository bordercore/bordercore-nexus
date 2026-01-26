import React from "react";
import { createRoot } from "react-dom/client";
import FitnessSummaryPage from "../react/fitness/FitnessSummaryPage";
import type { Exercise } from "../react/fitness/types";

const container = document.getElementById("react-root");
if (container) {
  const activeExercisesJson = container.getAttribute("data-active-exercises") || "[]";
  const inactiveExercisesJson = container.getAttribute("data-inactive-exercises") || "[]";

  let activeExercises: Exercise[] = [];
  let inactiveExercises: Exercise[] = [];

  try {
    activeExercises = JSON.parse(activeExercisesJson);
  } catch (e) {
    console.error("Error parsing active exercises:", e);
  }

  try {
    inactiveExercises = JSON.parse(inactiveExercisesJson);
  } catch (e) {
    console.error("Error parsing inactive exercises:", e);
  }

  const root = createRoot(container);
  root.render(
    <FitnessSummaryPage activeExercises={activeExercises} inactiveExercises={inactiveExercises} />
  );
}
