import React from "react";
import DrillPinnedTags from "../DrillPinnedTags";
import type { DrillUrls } from "../types";

interface Props {
  urls: DrillUrls;
}

export default function PinnedTagsCard({ urls }: Props) {
  return (
    <section className="drill-card drill-pinned-card">
      <DrillPinnedTags
        getPinnedTagsUrl={urls.getPinnedTags}
        pinTagUrl={urls.pinTag}
        unpinTagUrl={urls.unpinTag}
        sortPinnedTagsUrl={urls.sortPinnedTags}
        tagSearchUrl={urls.tagSearch}
      />
    </section>
  );
}
