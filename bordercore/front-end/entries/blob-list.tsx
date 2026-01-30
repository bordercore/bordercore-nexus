import React from "react";
import { createRoot } from "react-dom/client";
import BlobListPage from "../react/blob/BlobListPage";
import type { BlobListData, BlobListUrls } from "../react/blob/types";

const container = document.getElementById("react-root");

if (container) {
  // Read JSON data from script tag (Django's json_script filter)
  const blobListDataEl = document.getElementById("blob-list-data");
  const blobListData: BlobListData = blobListDataEl
    ? JSON.parse(blobListDataEl.textContent || '{"blobList":[],"docTypes":{}}')
    : { blobList: [], docTypes: {} };

  const urls: BlobListUrls = {
    createBlob: container.dataset.createBlobUrl || "",
    importBlob: container.dataset.importBlobUrl || "",
    bookshelf: container.dataset.bookshelfUrl || "",
  };

  const root = createRoot(container);
  root.render(<BlobListPage blobListData={blobListData} urls={urls} />);
}
