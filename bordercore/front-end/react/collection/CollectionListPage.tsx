import React, { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import ActionCluster from "./ActionCluster";
import CinemaCard from "./CinemaCard";
import CompactRow from "./CompactRow";
import CreateCollectionModal, { CreateCollectionModalHandle } from "./CreateCollectionModal";
import GridCard from "./GridCard";
import TagRail from "./TagRail";
import { filterCollections } from "./filter";
import { loadDensity, saveDensity, type Density } from "./density";
import type { Collection, CollectionListUrls, TagCounts } from "./types";
import VisualizerSlot from "../visualizers/VisualizerSlot";

interface CollectionListPageProps {
  collections: Collection[];
  tagCounts: TagCounts;
  urls: CollectionListUrls;
}

export function CollectionListPage({ collections, tagCounts, urls }: CollectionListPageProps) {
  const [density, setDensity] = useState<Density>(() => loadDensity());
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const createModalRef = useRef<CreateCollectionModalHandle>(null);

  useEffect(() => {
    saveDensity(density);
  }, [density]);

  const filtered = useMemo(
    () => filterCollections(collections, searchQuery, activeTag),
    [collections, searchQuery, activeTag]
  );

  const handleCreate = () => createModalRef.current?.openModal();

  return (
    <>
      <div className="cl-app">
        <div className="cl-shell">
          <div className="cl-viz">
            <VisualizerSlot />
          </div>

          <header className="cl-pagehead">
            <div className="cl-pagehead-text">
              <h1 className="cl-pagehead-title">
                <span className="bc-page-title">Collections</span>
              </h1>
              <div className="cl-pagehead-meta">
                <span className="count">{filtered.length}</span> collections
              </div>
            </div>

            <button type="button" className="refined-btn primary" onClick={handleCreate}>
              <FontAwesomeIcon icon={faPlus} className="refined-btn-icon" />
              new
            </button>
          </header>

          <TagRail
            totalCount={collections.length}
            tagCounts={tagCounts}
            activeTag={activeTag}
            onTagSelect={setActiveTag}
          />

          <main className="cl-main">
            <ActionCluster
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              density={density}
              filteredCount={filtered.length}
              onDensityChange={setDensity}
            />

            {filtered.length === 0 ? (
              <div className="cl-empty">No collections match the current filters.</div>
            ) : (
              <div className="cl-grid-v2" data-density={density}>
                {filtered.map(c => {
                  if (density === "compact") return <CompactRow key={c.uuid} collection={c} />;
                  if (density === "cinema") return <CinemaCard key={c.uuid} collection={c} />;
                  return <GridCard key={c.uuid} collection={c} />;
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      <CreateCollectionModal
        ref={createModalRef}
        createUrl={urls.createCollection}
        tagSearchUrl={urls.tagSearch}
      />
    </>
  );
}

export default CollectionListPage;
