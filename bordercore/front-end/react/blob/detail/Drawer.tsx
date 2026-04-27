import React, { useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";

import { PropertiesSection } from "./sections/PropertiesSection";
import { MetadataSection } from "./sections/MetadataSection";
import { UrlsSection } from "./sections/UrlsSection";
import type { BlobDetail, ElasticsearchInfo } from "../types";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  blob: BlobDetail;
  elasticsearchInfo: ElasticsearchInfo | null;
  metadataMisc: Record<string, string>;
  blobUrls: Array<{ url: string; domain: string }>;
}

export function Drawer({
  open,
  onClose,
  blob,
  elasticsearchInfo,
  metadataMisc,
  blobUrls,
}: DrawerProps) {
  // ESC closes the drawer.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {open && <div className="bd-drawer-backdrop" onClick={onClose} />}
      <aside className={`bd-drawer${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="bd-drawer-head">
          <h2>Details</h2>
          <button type="button" className="bd-iconbtn" onClick={onClose} aria-label="Close drawer">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <PropertiesSection blob={blob} elasticsearchInfo={elasticsearchInfo} />
        <MetadataSection metadata={metadataMisc} />
        <UrlsSection urls={blobUrls} />
      </aside>
    </>
  );
}

export default Drawer;
