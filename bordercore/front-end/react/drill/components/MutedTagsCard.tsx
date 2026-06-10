import React from "react";
import DrillMutedTags from "../DrillMutedTags";
import type { DrillUrls } from "../types";

interface Props {
  urls: DrillUrls;
}

export default function MutedTagsCard({ urls }: Props) {
  return (
    <section className="drill-card drill-muted-card">
      <DrillMutedTags
        getMutedTagsUrl={urls.getMutedTags}
        muteTagUrl={urls.muteTag}
        unmuteTagUrl={urls.unmuteTag}
        tagSearchUrl={urls.tagSearch}
      />
    </section>
  );
}
