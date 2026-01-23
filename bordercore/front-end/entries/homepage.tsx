import React from "react";
import { createRoot } from "react-dom/client";
import HomepagePage from "../react/homepage/HomepagePage";
import type {
  Task,
  DrillProgress,
  OverdueExercise,
  Bookmark,
  Song,
  Quote,
  RandomImageInfo,
  DefaultCollection,
} from "../react/homepage/types";

const container = document.getElementById("react-root");
if (container) {
  // Get URLs from data attributes
  const todoListUrl = container.getAttribute("data-todo-list-url") || "";
  const drillListUrl = container.getAttribute("data-drill-list-url") || "";
  const bookmarkOverviewUrl = container.getAttribute("data-bookmark-overview-url") || "";
  const bookmarkCreateUrl = container.getAttribute("data-bookmark-create-url") || "";
  const blobCreateUrl = container.getAttribute("data-blob-create-url") || "";
  const getCalendarEventsUrl = container.getAttribute("data-get-calendar-events-url") || "";

  // URL templates
  const exerciseDetailUrlTemplate =
    container.getAttribute("data-exercise-detail-url-template") || "";
  const bookmarkClickUrlTemplate =
    container.getAttribute("data-bookmark-click-url-template") || "";
  const artistDetailUrlTemplate =
    container.getAttribute("data-artist-detail-url-template") || "";
  const blobDetailUrlTemplate = container.getAttribute("data-blob-detail-url-template") || "";
  const collectionDetailUrlTemplate =
    container.getAttribute("data-collection-detail-url-template") || "";

  // Parse JSON data attributes
  const tasksJson = container.getAttribute("data-tasks") || "[]";
  const drillProgressJson = container.getAttribute("data-drill-progress") || '{"count":0,"percentage":0}';
  const overdueExercisesJson = container.getAttribute("data-overdue-exercises") || "[]";
  const dailyBookmarksJson = container.getAttribute("data-daily-bookmarks") || "[]";
  const pinnedBookmarksJson = container.getAttribute("data-pinned-bookmarks") || "[]";
  const bookmarksJson = container.getAttribute("data-bookmarks") || "[]";
  const musicJson = container.getAttribute("data-music") || "[]";
  const quoteJson = container.getAttribute("data-quote") || "null";
  const randomImageInfoJson = container.getAttribute("data-random-image-info") || "null";
  const defaultCollectionJson = container.getAttribute("data-default-collection") || "null";

  let tasks: Task[] = [];
  let drillProgress: DrillProgress = { count: 0, percentage: 0 };
  let overdueExercises: OverdueExercise[] = [];
  let dailyBookmarks: Bookmark[] = [];
  let pinnedBookmarks: Bookmark[] = [];
  let bookmarks: Bookmark[] = [];
  let music: Song[] = [];
  let quote: Quote | null = null;
  let randomImageInfo: RandomImageInfo | null = null;
  let defaultCollection: DefaultCollection | null = null;

  try {
    tasks = JSON.parse(tasksJson);
  } catch (e) {
    console.error("Error parsing tasks:", e);
    console.error("Raw tasksJson:", tasksJson);
  }

  try {
    drillProgress = JSON.parse(drillProgressJson);
  } catch (e) {
    console.error("Error parsing drill progress:", e);
  }

  try {
    overdueExercises = JSON.parse(overdueExercisesJson);
  } catch (e) {
    console.error("Error parsing overdue exercises:", e);
  }

  try {
    dailyBookmarks = JSON.parse(dailyBookmarksJson);
  } catch (e) {
    console.error("Error parsing daily bookmarks:", e);
  }

  try {
    pinnedBookmarks = JSON.parse(pinnedBookmarksJson);
  } catch (e) {
    console.error("Error parsing pinned bookmarks:", e);
  }

  try {
    bookmarks = JSON.parse(bookmarksJson);
  } catch (e) {
    console.error("Error parsing bookmarks:", e);
  }

  try {
    music = JSON.parse(musicJson);
  } catch (e) {
    console.error("Error parsing music:", e);
  }

  try {
    quote = JSON.parse(quoteJson);
  } catch (e) {
    console.error("Error parsing quote:", e);
  }

  try {
    randomImageInfo = JSON.parse(randomImageInfoJson);
  } catch (e) {
    console.error("Error parsing random image info:", e);
  }

  try {
    defaultCollection = JSON.parse(defaultCollectionJson);
  } catch (e) {
    console.error("Error parsing default collection:", e);
  }

  const root = createRoot(container);
  root.render(
    <HomepagePage
      todoListUrl={todoListUrl}
      drillListUrl={drillListUrl}
      bookmarkOverviewUrl={bookmarkOverviewUrl}
      bookmarkCreateUrl={bookmarkCreateUrl}
      blobCreateUrl={blobCreateUrl}
      getCalendarEventsUrl={getCalendarEventsUrl}
      tasks={tasks}
      drillProgress={drillProgress}
      overdueExercises={overdueExercises}
      dailyBookmarks={dailyBookmarks}
      pinnedBookmarks={pinnedBookmarks}
      bookmarks={bookmarks}
      music={music}
      quote={quote}
      randomImageInfo={randomImageInfo}
      defaultCollection={defaultCollection}
      exerciseDetailUrlTemplate={exerciseDetailUrlTemplate}
      bookmarkClickUrlTemplate={bookmarkClickUrlTemplate}
      artistDetailUrlTemplate={artistDetailUrlTemplate}
      blobDetailUrlTemplate={blobDetailUrlTemplate}
      collectionDetailUrlTemplate={collectionDetailUrlTemplate}
    />
  );
}
