import React, { useCallback, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

import { doPost } from "../../../utils/reactUtils";
import { AddPopover } from "../AddPopover";
import type { Collection, SearchResult } from "../../types";

interface CollectionsSectionProps {
  blobUuid: string;
  collections: Collection[];
  collectionSearchUrl: string;
  addToCollectionUrl: string;
  createCollectionUrl: string;
  onChanged: () => void;
}

export function CollectionsSection({
  blobUuid,
  collections,
  collectionSearchUrl,
  addToCollectionUrl,
  createCollectionUrl,
  onChanged,
}: CollectionsSectionProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);

  const handleAddExisting = useCallback(
    (item: SearchResult) => {
      doPost(addToCollectionUrl, { collection_uuid: item.uuid, blob_uuid: blobUuid }, () =>
        onChanged()
      );
    },
    [addToCollectionUrl, blobUuid, onChanged]
  );

  const handleCreate = useCallback(
    (name: string) => {
      doPost(createCollectionUrl, { name, blob_uuid: blobUuid }, () => onChanged());
    },
    [createCollectionUrl, blobUuid, onChanged]
  );

  return (
    <div className={`bd-rail-section${collections.length === 0 ? " is-empty" : ""}`}>
      <h3>
        Collections
        <span className="bd-section-actions">
          <button
            type="button"
            ref={addBtnRef}
            className="bd-section-act"
            onClick={() => setPopoverOpen(o => !o)}
            aria-label="Add to collection"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </span>
      </h3>
      <AddPopover
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        anchorRef={addBtnRef}
        searchUrl={q =>
          `${collectionSearchUrl}?exclude_blob_uuid=${blobUuid}&query=${encodeURIComponent(q)}`
        }
        parseResponse={(data: any) =>
          (Array.isArray(data) ? data : []).map((row: any) => ({
            uuid: row.uuid,
            name: row.name,
            url: row.url,
            cover_url: row.cover_url,
            num_objects: row.num_objects,
            type: "collection",
          }))
        }
        placeholder="search collections…"
        emptyHint="no collections"
        rowGlyph={item => (
          <span className="pop-cover">
            {item.cover_url ? (
              <img src={item.cover_url} alt="" />
            ) : (
              <span>{(item.name || "?").charAt(0).toUpperCase()}</span>
            )}
          </span>
        )}
        rowSubtext={item =>
          item.num_objects != null
            ? `${item.num_objects} ${item.num_objects === 1 ? "blob" : "blobs"}`
            : undefined
        }
        onSelect={handleAddExisting}
        onCreate={handleCreate}
        createLabel="create"
      />

      {collections.length === 0 ? (
        <div className="bd-empty">no collections</div>
      ) : (
        <div className="bd-collections">
          {collections.map(c => (
            <a key={c.uuid} className="bd-collection" href={c.url}>
              <span className="swatch">
                {c.coverUrl ? (
                  <img src={c.coverUrl} alt="" />
                ) : (
                  (c.name || "?").charAt(0).toUpperCase()
                )}
              </span>
              <span className="name">{c.name}</span>
              <span className="count">{c.numObjects}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default CollectionsSection;
