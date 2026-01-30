import React from "react";
import { createRoot } from "react-dom/client";
import NoteListPage from "../react/note/NoteListPage";
import type { NoteResult, PinnedNote } from "../react/note/types";
import type { Paginator } from "../react/search/types";

const container = document.getElementById("react-root");
if (container) {
  // Get data from data attributes
  const count = parseInt(container.getAttribute("data-count") || "0", 10);
  const isSearchResult = container.getAttribute("data-is-search-result") === "true";

  // Parse results from JSON script tag
  let initialResults: NoteResult[] = [];
  const resultsScript = document.getElementById("results");
  if (resultsScript) {
    try {
      initialResults = JSON.parse(resultsScript.textContent || "[]");
    } catch (e) {
      console.error("Error parsing results:", e);
    }
  }

  // Parse pinned notes from JSON script tag
  let pinnedNotes: PinnedNote[] = [];
  const pinnedNotesScript = document.getElementById("pinned-notes");
  if (pinnedNotesScript) {
    try {
      pinnedNotes = JSON.parse(pinnedNotesScript.textContent || "[]");
    } catch (e) {
      console.error("Error parsing pinned notes:", e);
    }
  }

  // Parse paginator from JSON script tag
  let paginator: Paginator | null = null;
  const paginatorScript = document.getElementById("paginator");
  if (paginatorScript) {
    try {
      const parsed = JSON.parse(paginatorScript.textContent || "null");
      if (parsed && Object.keys(parsed).length > 0) {
        paginator = parsed;
      }
    } catch (e) {
      console.error("Error parsing paginator:", e);
    }
  }

  // Get URLs from data attributes
  const urls = {
    notesSearch: container.getAttribute("data-notes-search-url") || "",
    createNote: container.getAttribute("data-create-note-url") || "",
    noteDetail: container.getAttribute("data-note-detail-url") || "",
    sortPinnedNotes: container.getAttribute("data-sort-pinned-notes-url") || "",
  };

  const root = createRoot(container);
  root.render(
    <NoteListPage
      initialResults={initialResults}
      pinnedNotes={pinnedNotes}
      paginator={paginator}
      count={count}
      isSearchResult={isSearchResult}
      urls={urls}
    />
  );
}
