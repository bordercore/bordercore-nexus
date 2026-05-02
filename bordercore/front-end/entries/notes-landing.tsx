import React from "react";
import { createRoot } from "react-dom/client";
import NotesLandingPage from "../react/note/landing/NotesLandingPage";
import type { NotesLandingData, NotesLandingUrls } from "../react/note/landing/types";

const EMPTY_DATA: NotesLandingData = {
  pinned: [],
  recents: [],
  tag_counts: [],
  totals: { pinned: 0, recents: 0, tags: 0 },
};

const container = document.getElementById("react-root");

if (container) {
  const dataEl = document.getElementById("notes-landing-data");
  const data: NotesLandingData = dataEl
    ? (JSON.parse(dataEl.textContent || "{}") as NotesLandingData)
    : EMPTY_DATA;

  const urls: NotesLandingUrls = {
    createNote: container.dataset.createNoteUrl || "",
    search: container.dataset.searchUrl || "",
    tagDetail: container.dataset.tagDetailUrl || "",
    sortPinned: container.dataset.sortPinnedUrl || "",
  };

  const root = createRoot(container);
  root.render(<NotesLandingPage data={data} urls={urls} />);
}
