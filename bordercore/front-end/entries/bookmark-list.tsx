import React from "react";
import { createRoot } from "react-dom/client";
import BookmarkListPage from "../react/bookmark/BookmarkListPage";
import type { PinnedTag, ViewType } from "../react/bookmark/types";

const container = document.getElementById("react-root");
if (container) {
  // Get URLs from data attributes
  const getBookmarksByPageUrl =
    container.getAttribute("data-get-bookmarks-by-page-url") || "";
  const getBookmarksByTagUrl =
    container.getAttribute("data-get-bookmarks-by-tag-url") || "";
  const getBookmarksByKeywordUrl =
    container.getAttribute("data-get-bookmarks-by-keyword-url") || "";
  const getTagsUsedByBookmarksUrl =
    container.getAttribute("data-get-tags-used-by-bookmarks-url") || "";
  const bookmarkDetailUrl =
    container.getAttribute("data-bookmark-detail-url") || "";
  const bookmarkUpdateUrl =
    container.getAttribute("data-bookmark-update-url") || "";
  const bookmarkCreateUrl =
    container.getAttribute("data-bookmark-create-url") || "";
  const bookmarkSortUrl =
    container.getAttribute("data-bookmark-sort-url") || "";
  const addTagUrl = container.getAttribute("data-add-tag-url") || "";
  const removeTagUrl = container.getAttribute("data-remove-tag-url") || "";
  const sortPinnedTagsUrl =
    container.getAttribute("data-sort-pinned-tags-url") || "";
  const pinTagUrl = container.getAttribute("data-pin-tag-url") || "";
  const unpinTagUrl = container.getAttribute("data-unpin-tag-url") || "";
  const storeInSessionUrl =
    container.getAttribute("data-store-in-session-url") || "";

  // Parse data from JSON script tags and data attributes
  const initialTag = container.getAttribute("data-initial-tag") || null;
  const untaggedCount = parseInt(
    container.getAttribute("data-untagged-count") || "0",
    10
  );
  const initialViewType = (container.getAttribute("data-view-type") ||
    "normal") as ViewType;

  // Parse pinned tags from JSON script tag
  let initialPinnedTags: PinnedTag[] = [];
  const pinnedTagsScript = document.getElementById("pinnedTags");
  if (pinnedTagsScript) {
    try {
      initialPinnedTags = JSON.parse(pinnedTagsScript.textContent || "[]");
    } catch (e) {
      console.error("Error parsing pinned tags:", e);
    }
  }

  const root = createRoot(container);
  root.render(
    <BookmarkListPage
      initialTag={initialTag}
      initialPinnedTags={initialPinnedTags}
      untaggedCount={untaggedCount}
      initialViewType={initialViewType}
      urls={{
        getBookmarksByPage: getBookmarksByPageUrl,
        getBookmarksByTag: getBookmarksByTagUrl,
        getBookmarksByKeyword: getBookmarksByKeywordUrl,
        getTagsUsedByBookmarks: getTagsUsedByBookmarksUrl,
        bookmarkDetail: bookmarkDetailUrl,
        bookmarkUpdate: bookmarkUpdateUrl,
        bookmarkCreate: bookmarkCreateUrl,
        bookmarkSort: bookmarkSortUrl,
        addTag: addTagUrl,
        removeTag: removeTagUrl,
        sortPinnedTags: sortPinnedTagsUrl,
        pinTag: pinTagUrl,
        unpinTag: unpinTagUrl,
        storeInSession: storeInSessionUrl,
      }}
    />
  );
}
