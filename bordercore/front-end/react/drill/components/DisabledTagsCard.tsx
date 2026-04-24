import React from "react";
import DrillDisabledTags from "../DrillDisabledTags";
import type { DrillUrls } from "../types";

interface Props {
  urls: DrillUrls;
}

export default function DisabledTagsCard({ urls }: Props) {
  return (
    <section className="drill-card drill-disabled-card">
      <DrillDisabledTags
        getDisabledTagsUrl={urls.getDisabledTags}
        disableTagUrl={urls.disableTag}
        enableTagUrl={urls.enableTag}
        tagSearchUrl={urls.tagSearch}
      />
    </section>
  );
}
