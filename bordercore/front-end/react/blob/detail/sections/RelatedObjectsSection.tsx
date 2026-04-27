import React, { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTimes, faFileAlt } from "@fortawesome/free-solid-svg-icons";

import { doGet, doPost, EventBus } from "../../../utils/reactUtils";
import { AddPopover } from "../AddPopover";
import type { RelatedObjectItem, SearchResult } from "../../types";

interface RelatedObjectsSectionProps {
  blobUuid: string;
  relatedObjectsUrl: string;
  addRelatedObjectUrl: string;
  removeRelatedObjectUrl: string;
  searchNamesUrl: string;
  createBlobUrl: string;
}

export function RelatedObjectsSection({
  blobUuid,
  relatedObjectsUrl,
  addRelatedObjectUrl,
  removeRelatedObjectUrl,
  searchNamesUrl,
  createBlobUrl,
}: RelatedObjectsSectionProps) {
  const [items, setItems] = useState<RelatedObjectItem[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);

  const refresh = useCallback(() => {
    doGet(
      relatedObjectsUrl,
      response => {
        const data = response.data;
        const list = Array.isArray(data) ? data : (data?.related_objects ?? []);
        setItems(list);
      },
      "Error loading related objects"
    );
  }, [relatedObjectsUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSelect = useCallback(
    (item: SearchResult) => {
      doPost(
        addRelatedObjectUrl,
        {
          node_type: "blob",
          node_uuid: blobUuid,
          object_uuid: item.uuid,
        },
        () => refresh()
      );
    },
    [addRelatedObjectUrl, blobUuid, refresh]
  );

  const handleRemove = useCallback(
    (item: RelatedObjectItem) => {
      if (!confirm(`Remove "${item.name || "this object"}" from related?`)) return;
      doPost(
        removeRelatedObjectUrl,
        {
          node_type: "blob",
          node_uuid: blobUuid,
          object_uuid: item.uuid,
        },
        () => {
          EventBus.$emit("toast", { body: "Removed" });
          refresh();
        }
      );
    },
    [removeRelatedObjectUrl, blobUuid, refresh]
  );

  return (
    <div className={`bd-rail-section${items.length === 0 ? " is-empty" : ""}`}>
      <h3>
        Related
        <span className="bd-section-actions">
          <button
            type="button"
            ref={addBtnRef}
            className="bd-section-act"
            onClick={() => setPopoverOpen(o => !o)}
            aria-label="Add related object"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </span>
      </h3>
      <AddPopover
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        anchorRef={addBtnRef}
        searchUrl={q => `${searchNamesUrl}?term=${encodeURIComponent(q)}`}
        parseResponse={(data: any) =>
          (Array.isArray(data) ? data : []).map((row: any) => ({
            uuid: row.uuid,
            name: row.name,
            question: row.question,
            doctype: row.doctype,
            type: row.type,
          }))
        }
        placeholder="search blobs, bookmarks, drill…"
        rowSubtext={r => r.doctype || r.type}
        onSelect={handleSelect}
      />

      {items.length === 0 ? (
        <div className="bd-empty">no related objects</div>
      ) : (
        <ul className="bd-related">
          {items.map(item => (
            <li key={item.bc_object_uuid || item.uuid} className="bd-related-row">
              <a
                className="bd-related-item"
                href={item.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="cover">
                  {item.cover_url ? (
                    <img src={item.cover_url} alt="" />
                  ) : (
                    <span>{(item.name || "?").charAt(0).toUpperCase()}</span>
                  )}
                </span>
                <span className="body">
                  <span className="name">{item.name || "Untitled"}</span>
                  <span className="sub">{item.type}</span>
                </span>
              </a>
              <span className="bd-related-actions">
                <button
                  type="button"
                  className="bd-row-act"
                  onClick={() => handleRemove(item)}
                  aria-label="Remove"
                  title="Remove from related"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
                <a
                  className="bd-row-act"
                  href={`${createBlobUrl}?linked_blob_uuid=${item.uuid}&is_note=true`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="New note"
                  title="New note linked to this"
                >
                  <FontAwesomeIcon icon={faFileAlt} />
                </a>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RelatedObjectsSection;
