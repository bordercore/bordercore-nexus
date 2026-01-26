import React from "react";
import { createRoot } from "react-dom/client";
import DrillListPage from "../react/drill/DrillListPage";

interface StudySession {
  type: string;
  tag?: string;
  search_term?: string;
  list: string[];
}

interface FeaturedTagInfo {
  name: string;
  url: string;
  last_reviewed: string;
  count: number;
  progress: number;
}

interface TagLastReviewed {
  name: string;
  last_reviewed: string | null;
}

const container = document.getElementById("react-root");
if (container) {
  // Get URLs from data attributes
  const drillListUrl = container.getAttribute("data-drill-list-url") || "";
  const drillAddUrl = container.getAttribute("data-drill-add-url") || "";
  const startStudySessionUrl = container.getAttribute("data-start-study-session-url") || "";
  const resumeUrl = container.getAttribute("data-resume-url") || "";
  const getPinnedTagsUrl = container.getAttribute("data-get-pinned-tags-url") || "";
  const pinTagUrl = container.getAttribute("data-pin-tag-url") || "";
  const unpinTagUrl = container.getAttribute("data-unpin-tag-url") || "";
  const sortPinnedTagsUrl = container.getAttribute("data-sort-pinned-tags-url") || "";
  const getDisabledTagsUrl = container.getAttribute("data-get-disabled-tags-url") || "";
  const disableTagUrl = container.getAttribute("data-disable-tag-url") || "";
  const enableTagUrl = container.getAttribute("data-enable-tag-url") || "";
  const tagSearchUrl = container.getAttribute("data-tag-search-url") || "";

  // Parse JSON data attributes
  const title = container.getAttribute("data-title") || "Drill";
  const studySessionJson = container.getAttribute("data-study-session") || "null";
  const studySessionProgress = parseInt(container.getAttribute("data-study-session-progress") || "0", 10);
  const totalProgressJson = container.getAttribute("data-total-progress") || '{"count":0,"percentage":0}';
  const favoriteProgressJson = container.getAttribute("data-favorite-progress") || '{"count":0,"percentage":0}';
  const tagsLastReviewedJson = container.getAttribute("data-tags-last-reviewed") || "[]";
  const featuredTagJson = container.getAttribute("data-featured-tag") || "null";

  let studySession: StudySession | null = null;
  let totalProgress = { count: 0, percentage: 0 };
  let favoriteQuestionsProgress = { count: 0, percentage: 0 };
  let tagsLastReviewed: TagLastReviewed[] = [];
  let featuredTag: FeaturedTagInfo = {
    name: "",
    url: "",
    last_reviewed: "",
    count: 0,
    progress: 0,
  };

  try {
    studySession = JSON.parse(studySessionJson);
  } catch (e) {
    console.error("Error parsing study session:", e);
  }

  try {
    totalProgress = JSON.parse(totalProgressJson);
  } catch (e) {
    console.error("Error parsing total progress:", e);
  }

  try {
    favoriteQuestionsProgress = JSON.parse(favoriteProgressJson);
  } catch (e) {
    console.error("Error parsing favorite progress:", e);
  }

  try {
    tagsLastReviewed = JSON.parse(tagsLastReviewedJson);
  } catch (e) {
    console.error("Error parsing tags last reviewed:", e);
  }

  try {
    featuredTag = JSON.parse(featuredTagJson) || featuredTag;
  } catch (e) {
    console.error("Error parsing featured tag:", e);
  }

  const root = createRoot(container);
  root.render(
    <DrillListPage
      title={title}
      studySession={studySession}
      studySessionProgress={studySessionProgress}
      totalProgress={totalProgress}
      favoriteQuestionsProgress={favoriteQuestionsProgress}
      tagsLastReviewed={tagsLastReviewed}
      initialFeaturedTag={featuredTag}
      urls={{
        drillList: drillListUrl,
        drillAdd: drillAddUrl,
        startStudySession: startStudySessionUrl,
        resume: resumeUrl,
        getPinnedTags: getPinnedTagsUrl,
        pinTag: pinTagUrl,
        unpinTag: unpinTagUrl,
        sortPinnedTags: sortPinnedTagsUrl,
        getDisabledTags: getDisabledTagsUrl,
        disableTag: disableTagUrl,
        enableTag: enableTagUrl,
        tagSearch: tagSearchUrl,
      }}
    />
  );
}
