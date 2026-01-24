import React from "react";
import { createRoot } from "react-dom/client";
import FeedPage from "../react/feed/FeedPage";
import type { Feed } from "../react/feed/types";

const container = document.getElementById("react-root");
if (container) {
  // Get URLs from data attributes
  const feedSortUrl = container.getAttribute("data-feed-sort-url") || "";
  const storeInSessionUrl = container.getAttribute("data-store-in-session-url") || "";
  const editFeedUrl = container.getAttribute("data-edit-feed-url") || "";
  const newFeedUrl = container.getAttribute("data-new-feed-url") || "";
  const feedCheckUrl = container.getAttribute("data-feed-check-url") || "";

  // Parse JSON data attributes
  const feedListJson = container.getAttribute("data-feed-list") || "[]";
  const currentFeedJson = container.getAttribute("data-current-feed") || "null";

  let feedList: Feed[] = [];
  let currentFeed: Feed | null = null;

  try {
    feedList = JSON.parse(feedListJson);
  } catch (e) {
    console.error("Error parsing feed list:", e);
  }

  try {
    currentFeed = JSON.parse(currentFeedJson);
  } catch (e) {
    console.error("Error parsing current feed:", e);
  }

  if (feedSortUrl && editFeedUrl && newFeedUrl) {
    const root = createRoot(container);
    root.render(
      <FeedPage
        initialFeedList={feedList}
        initialCurrentFeed={currentFeed}
        feedSortUrl={feedSortUrl}
        storeInSessionUrl={storeInSessionUrl}
        editFeedUrl={editFeedUrl}
        newFeedUrl={newFeedUrl}
        feedCheckUrl={feedCheckUrl}
      />
    );
  } else {
    console.error("FeedPage: Missing required URLs");
  }
}
