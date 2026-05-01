import React from "react";
import { createRoot } from "react-dom/client";
import RecentBlobsDashboard from "../react/blob/dashboard/RecentBlobsDashboard";
import type { DashboardData, DashboardUrls } from "../react/blob/dashboard/types";

const EMPTY_DATA: DashboardData = {
  blobs: [],
  total_count: 0,
  doctype_counts: { all: 0, note: 0, book: 0, image: 0, video: 0, document: 0, blob: 0 },
  tag_counts: [],
  tag_total: 0,
  date_bucket_counts: {
    today: 0,
    "this-week": 0,
    "last-week": 0,
    "this-month": 0,
    older: 0,
  },
  starred_count: 0,
  pinned_count: 0,
};

const container = document.getElementById("react-root");

if (container) {
  const dataEl = document.getElementById("blob-dashboard-data");
  const data: DashboardData = dataEl
    ? (JSON.parse(dataEl.textContent || "{}") as DashboardData)
    : EMPTY_DATA;

  const urls: DashboardUrls = {
    createBlob: container.dataset.createBlobUrl || "",
    importBlob: container.dataset.importBlobUrl || "",
    bookshelf: container.dataset.bookshelfUrl || "",
  };

  const root = createRoot(container);
  root.render(<RecentBlobsDashboard data={data} urls={urls} />);
}
