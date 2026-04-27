import React, { useCallback, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

import { doPost } from "../../../utils/reactUtils";
import { AddPopover } from "../AddPopover";
import type { BackReference, SearchResult } from "../../types";

interface BackrefsSectionProps {
  blobUuid: string;
  backRefs: BackReference[];
  addRelatedObjectUrl: string;
  searchNamesUrl: string;
  createBlobUrl: string;
  // Render the section as a content-footer block instead of a rail card.
  asFooter?: boolean;
  onChanged: () => void;
}

export function BackrefsSection({
  blobUuid,
  backRefs,
  addRelatedObjectUrl,
  searchNamesUrl,
  createBlobUrl,
  asFooter,
  onChanged,
}: BackrefsSectionProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);

  // "Link from existing blob" — make the chosen blob point at us.
  const handleLinkExisting = useCallback(
    (item: SearchResult) => {
      doPost(
        addRelatedObjectUrl,
        {
          node_type: "blob",
          node_uuid: item.uuid, // linker
          object_uuid: blobUuid, // linked (this blob)
        },
        () => onChanged()
      );
    },
    [addRelatedObjectUrl, blobUuid, onChanged]
  );

  const sectionClass = asFooter
    ? "bd-backref-footer"
    : `bd-rail-section${backRefs.length === 0 ? " is-empty" : ""}`;

  return (
    <div className={sectionClass}>
      <h3>
        Back-references
        {!asFooter && (
          <span className="bd-section-actions">
            <button
              type="button"
              ref={addBtnRef}
              className="bd-section-act"
              onClick={() => setPopoverOpen(o => !o)}
              aria-label="Link from another blob"
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </span>
        )}
      </h3>

      {!asFooter && (
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
          placeholder="link from another blob…"
          rowSubtext={r => r.doctype || r.type}
          onSelect={handleLinkExisting}
          onCreate={() => {
            window.location.href = `${createBlobUrl}?linked_blob_uuid=${blobUuid}`;
          }}
          createLabel="create new blob"
        />
      )}

      {backRefs.length === 0 ? (
        !asFooter && <div className="bd-empty">no back-references</div>
      ) : (
        <div className={asFooter ? "bd-backref-footer-grid" : "bd-backrefs"}>
          {backRefs.map((ref, i) => (
            <a key={i} className="bd-backref" href={ref.url}>
              <span className="type-pill">{ref.type}</span>
              <span className="name">{ref.name || ref.question || "Untitled"}</span>
              {ref.tags && ref.tags.length > 0 && (
                <span className="tags">
                  {ref.tags.map(t => (
                    <span key={t}>#{t}</span>
                  ))}
                </span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default BackrefsSection;
