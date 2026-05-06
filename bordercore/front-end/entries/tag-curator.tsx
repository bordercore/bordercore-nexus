import React from "react";
import { createRoot } from "react-dom/client";
import { TagCuratorPage } from "../react/tag/curator/TagCuratorPage";
import type { TagBootstrap, CuratorUrls } from "../react/tag/curator/types";

const container = document.getElementById("react-root");

if (container) {
  const bootstrapEl = document.getElementById("tag-curator-bootstrap");
  if (!bootstrapEl) throw new Error("Missing #tag-curator-bootstrap script tag");
  const bootstrap = JSON.parse(bootstrapEl.textContent || "{}") as TagBootstrap;

  const urls: CuratorUrls = {
    tagDetailBase: container.dataset.tagDetailBase || "/tag/",
    tagSearchUrl: container.dataset.tagSearchUrl || "",
    tagSnapshotUrl: container.dataset.tagSnapshotUrl || "",
    pinUrl: container.dataset.pinUrl || "",
    unpinUrl: container.dataset.unpinUrl || "",
    setMetaUrl: container.dataset.setMetaUrl || "",
    addAliasUrl: container.dataset.addAliasUrl || "",
    tagAliasDetailUrl: container.dataset.tagAliasDetailUrl || "",
  };

  createRoot(container).render(<TagCuratorPage bootstrap={bootstrap} urls={urls} />);
}
