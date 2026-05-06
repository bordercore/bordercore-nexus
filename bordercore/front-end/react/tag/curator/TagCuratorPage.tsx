import React, { useMemo } from "react";
import { TagSearch } from "./TagSearch";
import { NeonChip } from "./NeonChip";
import { TagControlsCard } from "./TagControlsCard";
import { AliasForge } from "./AliasForge";
import { CoOccurringTags } from "./CoOccurringTags";
import { useTagWorkspace } from "./useTagWorkspace";
import type { TagBootstrap, CuratorUrls } from "./types";

interface Props {
  bootstrap: TagBootstrap;
  urls: CuratorUrls;
}

export function TagCuratorPage({ bootstrap, urls }: Props) {
  const ws = useTagWorkspace(bootstrap, urls);

  const totalRefs = useMemo(
    () => Object.values(ws.tag.counts).reduce((a, c) => a + c.count, 0),
    [ws.tag.counts],
  );
  const liveSurfaces = useMemo(
    () => Object.values(ws.tag.counts).filter(c => c.count > 0).length,
    [ws.tag.counts],
  );

  const navigate = (name: string) => {
    void ws.setActiveName(name);
    if (window.history && window.history.pushState) {
      window.history.pushState(
        {},
        "",
        `${urls.tagDetailBase}${encodeURIComponent(name)}/`,
      );
    }
  };

  return (
    <div className="tg-curator-screen">
      <div className="tg-subheader">
        <div className="tg-path">
          <span>kb</span>
          <span className="tg-path__slash">/</span>
          <span>tags</span>
          <span className="tg-path__slash">/</span>
          <span className="tg-path__leaf">{ws.tag.name}</span>
        </div>
        <TagSearch
          activeName={ws.activeName}
          searchUrl={urls.tagSearchUrl}
          onPick={navigate}
        />
      </div>

      <div className="tg-body">
        <section className="tg-hero">
          <NeonChip name={ws.tag.name} />
          <div className="tg-hero__meta">
            <span>created {ws.tag.created}</span>
            <span className="tg-hero__sep">·</span>
            <span>{totalRefs} refs across {liveSurfaces} surfaces</span>
            <span className="tg-hero__sep">·</span>
            <span>{ws.tag.aliases.length} aliases</span>
          </div>
        </section>

        <section className="tg-row">
          <TagControlsCard
            tag={ws.tag}
            onPinnedToggle={() => ws.setPinned(!ws.tag.pinned)}
            onMetaToggle={() => ws.setMeta(!ws.tag.meta)}
          />
          <AliasForge
            activeName={ws.activeName}
            tagNames={ws.tagNames}
            aliasLibrary={ws.aliasLibrary}
            onAdd={ws.addAlias}
            onRemove={ws.removeAlias}
            onPickTag={navigate}
          />
        </section>

        <CoOccurringTags
          activeName={ws.activeName}
          related={ws.tag.related}
          knownTagNames={ws.tagNames}
          onPick={navigate}
        />
      </div>
    </div>
  );
}
