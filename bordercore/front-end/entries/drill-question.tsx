import React from "react";
import { createRoot } from "react-dom/client";
import DrillQuestionPage from "../react/drill/DrillQuestionPage";

interface TagInfo {
  name: string;
  count: number;
  progress: number;
}

interface StudySession {
  type: string;
  tag?: string;
  list: string[];
}

const container = document.getElementById("react-root");
if (container) {
  // Get URLs from data attributes
  const drillListUrl = container.getAttribute("data-drill-list-url") || "";
  const drillAddUrl = container.getAttribute("data-drill-add-url") || "";
  const drillAddWithTagUrl = container.getAttribute("data-drill-add-with-tag-url") || "";
  const drillUpdateUrl = container.getAttribute("data-drill-update-url") || "";
  const drillStudyUrl = container.getAttribute("data-drill-study-url") || "";
  const recordResponseGoodUrl = container.getAttribute("data-record-response-good-url") || "";
  const recordResponseHardUrl = container.getAttribute("data-record-response-hard-url") || "";
  const recordResponseEasyUrl = container.getAttribute("data-record-response-easy-url") || "";
  const recordResponseResetUrl = container.getAttribute("data-record-response-reset-url") || "";
  const isFavoriteMutateUrl = container.getAttribute("data-is-favorite-mutate-url") || "";
  const relatedObjectsUrl = container.getAttribute("data-related-objects-url") || "";
  const newObjectUrl = container.getAttribute("data-new-object-url") || "";
  const removeObjectUrl = container.getAttribute("data-remove-object-url") || "";
  const sortRelatedObjectsUrl = container.getAttribute("data-sort-related-objects-url") || "";
  const editRelatedObjectNoteUrl = container.getAttribute("data-edit-related-object-note-url") || "";
  const searchNamesUrl = container.getAttribute("data-search-names-url") || "";
  const getRelatedTagsUrl = container.getAttribute("data-get-related-tags-url") || "";
  const sqlPlaygroundUrl = container.getAttribute("data-sql-playground-url") || "";
  const startStudySessionUrl = container.getAttribute("data-start-study-session-url") || "";
  const currentPath = container.getAttribute("data-current-path") || "";

  // Parse JSON data attributes
  const questionJson = container.getAttribute("data-question") || "{}";
  const lastResponse = container.getAttribute("data-last-response") || null;
  const tagInfoJson = container.getAttribute("data-tag-info") || "[]";
  const intervalsJson = container.getAttribute("data-intervals") || "{}";
  const reverseQuestion = container.getAttribute("data-reverse-question") === "true";
  const studySessionProgress = parseInt(container.getAttribute("data-study-session-progress") || "0", 10);
  const studySessionJson = container.getAttribute("data-study-session") || "null";
  const sqlDbJson = container.getAttribute("data-sql-db") || "null";

  let question = {
    uuid: "",
    question: "",
    answer: "",
    lastReviewed: null as string | null,
    interval: 1,
    needsReview: false,
    isFavorite: false,
    isDisabled: false,
    isReversible: false,
    tags: [] as { name: string }[],
  };
  let tagInfo: TagInfo[] = [];
  let intervals: Record<string, { description: string }> = {};
  let studySession: StudySession | null = null;
  let sqlDb: { blob: { uuid: string } } | null = null;

  try {
    question = JSON.parse(questionJson);
  } catch (e) {
    console.error("Error parsing question:", e);
  }

  try {
    tagInfo = JSON.parse(tagInfoJson);
  } catch (e) {
    console.error("Error parsing tag info:", e);
  }

  try {
    intervals = JSON.parse(intervalsJson);
  } catch (e) {
    console.error("Error parsing intervals:", e);
  }

  try {
    studySession = JSON.parse(studySessionJson);
  } catch (e) {
    console.error("Error parsing study session:", e);
  }

  try {
    sqlDb = JSON.parse(sqlDbJson);
  } catch (e) {
    console.error("Error parsing SQL db:", e);
  }

  const root = createRoot(container);
  root.render(
    <DrillQuestionPage
      question={question}
      lastResponse={lastResponse}
      tagInfo={tagInfo}
      intervals={intervals}
      reverseQuestion={reverseQuestion}
      studySessionProgress={studySessionProgress}
      studySession={studySession}
      sqlDb={sqlDb}
      urls={{
        drillList: drillListUrl,
        drillAdd: drillAddUrl,
        drillAddWithTag: drillAddWithTagUrl,
        drillUpdate: drillUpdateUrl,
        drillStudy: drillStudyUrl,
        recordResponseGood: recordResponseGoodUrl,
        recordResponseHard: recordResponseHardUrl,
        recordResponseEasy: recordResponseEasyUrl,
        recordResponseReset: recordResponseResetUrl,
        isFavoriteMutate: isFavoriteMutateUrl,
        relatedObjects: relatedObjectsUrl,
        newObject: newObjectUrl,
        removeObject: removeObjectUrl,
        sortRelatedObjects: sortRelatedObjectsUrl,
        editRelatedObjectNote: editRelatedObjectNoteUrl,
        searchNames: searchNamesUrl,
        getRelatedTags: getRelatedTagsUrl,
        sqlPlayground: sqlPlaygroundUrl,
        startStudySession: startStudySessionUrl,
      }}
      currentPath={currentPath}
    />
  );
}
