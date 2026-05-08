import React, { useEffect, useMemo, useRef, useState } from "react";
import ActionCluster from "./ActionCluster";
import CinemaCard from "./CinemaCard";
import CompactRow from "./CompactRow";
import CreateCollectionModal, { CreateCollectionModalHandle } from "./CreateCollectionModal";
import GridCard from "./GridCard";
import TagRail from "./TagRail";
import { filterCollections } from "./filter";
import { loadDensity, saveDensity, type Density } from "./density";
import type { Collection, CollectionListUrls, TagCounts } from "./types";

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
      <div className="cl-shell">
        <TagRail
          totalCount={collections.length}
          tagCounts={tagCounts}
          activeTag={activeTag}
          onTagSelect={setActiveTag}
        />

        <main className="cl-main">
          <header className="cl-pagehead">
            <div>
              <h1 className="cl-pagehead-title">
                <span className="cl-fav-star" aria-hidden="true">
                  ★
                </span>
                <span className="bc-page-title">Favorites</span>
              </h1>
              <div className="cl-pagehead-meta">{filtered.length} collections</div>
            </div>

            <ActionCluster
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              density={density}
              filteredCount={filtered.length}
              onDensityChange={setDensity}
              onCreateClick={handleCreate}
            />
          </header>

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

      <CreateCollectionModal
        ref={createModalRef}
        createUrl={urls.createCollection}
        tagSearchUrl={urls.tagSearch}
      />
    </>
  );
}

export default CollectionListPage;
