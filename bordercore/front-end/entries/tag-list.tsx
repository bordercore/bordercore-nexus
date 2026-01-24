import React from "react";
import { createRoot } from "react-dom/client";
import TagListPage from "../react/tag/TagListPage";
import type { TagInfo, TagListUrls } from "../react/tag/types";

const container = document.getElementById("react-root");

if (container) {
  // Read initial tag info from JSON script tag
  const randomTagInfoEl = document.getElementById("random_tag_info");
  const initialTagInfo: TagInfo = randomTagInfoEl
    ? JSON.parse(randomTagInfoEl.textContent || '{"name": ""}')
    : { name: "" };

  // Read URLs from data attributes
  const urls: TagListUrls = {
    tagSearchUrl: container.dataset.tagSearchUrl || "",
    tagAliasListUrl: container.dataset.tagAliasListUrl || "",
    tagAliasDetailUrl: container.dataset.tagAliasDetailUrl || "",
    getTodoCountsUrl: container.dataset.getTodoCountsUrl || "",
    addAliasUrl: container.dataset.addAliasUrl || "",
  };

  const root = createRoot(container);
  root.render(<TagListPage initialTagInfo={initialTagInfo} urls={urls} />);
}
