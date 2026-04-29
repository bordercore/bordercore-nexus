import React from "react";
import { createRoot } from "react-dom/client";
import BookmarkListPage from "../react/bookmark/BookmarkListPage";
import type {
  BookmarkStats,
  PinnedBookmark,
  PinnedTag,
  ViewType,
} from "../react/bookmark/types";

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
  const bookmarkCreateApiUrl =
    container.getAttribute("data-bookmark-create-api-url") || "";
  const tagSearchUrl = container.getAttribute("data-tag-search-url") || "";
  const getTitleFromUrl =
    container.getAttribute("data-get-title-from-url") || "";
  const bookmarkSortUrl =
    container.getAttribute("data-bookmark-sort-url") || "";
  const addTagUrl = container.getAttribute("data-add-tag-url") || "";
  const removeTagUrl = container.getAttribute("data-remove-tag-url") || "";
  const sortPinnedTagsUrl =
    container.getAttribute("data-sort-pinned-tags-url") || "";
  const pinTagUrl = container.getAttribute("data-pin-tag-url") || "";
  const unpinTagUrl = container.getAttribute("data-unpin-tag-url") || "";
  const pinBookmarkUrl =
    container.getAttribute("data-pin-bookmark-url") || "";
  const unpinBookmarkUrl =
    container.getAttribute("data-unpin-bookmark-url") || "";
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

  // Parse pinned bookmarks from JSON script tag
  let initialPinnedBookmarks: PinnedBookmark[] = [];
  const pinnedBookmarksScript = document.getElementById("pinnedBookmarks");
  if (pinnedBookmarksScript) {
    try {
      initialPinnedBookmarks = JSON.parse(
        pinnedBookmarksScript.textContent || "[]"
      );
    } catch (e) {
      console.error("Error parsing pinned bookmarks:", e);
    }
  }

  // Parse bookmark stats from JSON script tag
  let stats: BookmarkStats = {
    total_count: 0,
    untagged_count: 0,
    broken_count: 0,
    top_domain: "\u2014",
    tag_coverage_pct: 0,
  };
  const statsScript = document.getElementById("bookmarkStats");
  if (statsScript) {
    try {
      stats = JSON.parse(statsScript.textContent || "{}");
    } catch (e) {
      console.error("Error parsing bookmark stats:", e);
    }
  }

  const root = createRoot(container);
  root.render(
    <BookmarkListPage
      initialTag={initialTag}
      initialPinnedTags={initialPinnedTags}
      initialPinnedBookmarks={initialPinnedBookmarks}
      untaggedCount={untaggedCount}
      initialViewType={initialViewType}
      stats={stats}
      urls={{
        getBookmarksByPage: getBookmarksByPageUrl,
        getBookmarksByTag: getBookmarksByTagUrl,
        getBookmarksByKeyword: getBookmarksByKeywordUrl,
        getTagsUsedByBookmarks: getTagsUsedByBookmarksUrl,
        bookmarkDetail: bookmarkDetailUrl,
        bookmarkUpdate: bookmarkUpdateUrl,
        bookmarkCreate: bookmarkCreateUrl,
        bookmarkCreateApi: bookmarkCreateApiUrl,
        tagSearch: tagSearchUrl,
        getTitleFromUrl: getTitleFromUrl,
        bookmarkSort: bookmarkSortUrl,
        addTag: addTagUrl,
        removeTag: removeTagUrl,
        sortPinnedTags: sortPinnedTagsUrl,
        pinTag: pinTagUrl,
        unpinTag: unpinTagUrl,
        pinBookmark: pinBookmarkUrl,
        unpinBookmark: unpinBookmarkUrl,
        storeInSession: storeInSessionUrl,
      }}
    />
  );
}
