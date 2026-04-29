import React from "react";
import { createRoot } from "react-dom/client";
import { MagazinePage } from "../react/homepage/magazine/MagazinePage";
import type {
  Bookmark,
  DefaultCollection,
  DrillProgress,
  OverdueExercise,
  Quote,
  RandomImageInfo,
  Song,
  Task,
} from "../react/homepage/types";

function parseJson<T>(raw: string | null, fallback: T, label: string): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`Error parsing ${label}:`, e);
    return fallback;
  }
}

const container = document.getElementById("react-root");
if (container) {
  const todoListUrl = container.getAttribute("data-todo-list-url") || "";
  const drillListUrl = container.getAttribute("data-drill-list-url") || "";
  const bookmarkOverviewUrl = container.getAttribute("data-bookmark-overview-url") || "";
  const getCalendarEventsUrl = container.getAttribute("data-get-calendar-events-url") || "";

  const userName = container.getAttribute("data-user-name") || "";

  const exerciseDetailUrlTemplate =
    container.getAttribute("data-exercise-detail-url-template") || "";
  const bookmarkClickUrlTemplate =
    container.getAttribute("data-bookmark-click-url-template") || "";
  const artistDetailUrlTemplate =
    container.getAttribute("data-artist-detail-url-template") || "";
  const blobDetailUrlTemplate = container.getAttribute("data-blob-detail-url-template") || "";
  const collectionDetailUrlTemplate =
    container.getAttribute("data-collection-detail-url-template") || "";

  const tasks = parseJson<Task[]>(container.getAttribute("data-tasks"), [], "tasks");
  const drillProgress = parseJson<DrillProgress>(
    container.getAttribute("data-drill-progress"),
    { count: 0, percentage: 0 },
    "drill progress",
  );
  const overdueExercises = parseJson<OverdueExercise[]>(
    container.getAttribute("data-overdue-exercises"),
    [],
    "overdue exercises",
  );
  const dailyBookmarks = parseJson<Bookmark[]>(
    container.getAttribute("data-daily-bookmarks"),
    [],
    "daily bookmarks",
  );
  const bookmarks = parseJson<Bookmark[]>(
    container.getAttribute("data-bookmarks"),
    [],
    "bookmarks",
  );
  const music = parseJson<Song[]>(container.getAttribute("data-music"), [], "music");
  const quote = parseJson<Quote | null>(container.getAttribute("data-quote"), null, "quote");
  const randomImageInfo = parseJson<RandomImageInfo | null>(
    container.getAttribute("data-random-image-info"),
    null,
    "random image info",
  );
  const defaultCollection = parseJson<DefaultCollection | null>(
    container.getAttribute("data-default-collection"),
    null,
    "default collection",
  );

  const root = createRoot(container);
  root.render(
    <MagazinePage
      todoListUrl={todoListUrl}
      drillListUrl={drillListUrl}
      bookmarkOverviewUrl={bookmarkOverviewUrl}
      getCalendarEventsUrl={getCalendarEventsUrl}
      tasks={tasks}
      drillProgress={drillProgress}
      overdueExercises={overdueExercises}
      dailyBookmarks={dailyBookmarks}
      bookmarks={bookmarks}
      music={music}
      quote={quote}
      randomImageInfo={randomImageInfo}
      defaultCollection={defaultCollection}
      userName={userName}
      exerciseDetailUrlTemplate={exerciseDetailUrlTemplate}
      bookmarkClickUrlTemplate={bookmarkClickUrlTemplate}
      artistDetailUrlTemplate={artistDetailUrlTemplate}
      blobDetailUrlTemplate={blobDetailUrlTemplate}
      collectionDetailUrlTemplate={collectionDetailUrlTemplate}
    />,
  );
}
