import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faObjectGroup,
  faStickyNote,
  faImage,
  faVideo,
  faFile,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { Popover } from "../common/Popover";

interface BlobLink {
  uuid: string;
  name: string;
  doctype: string;
  url: string;
  clickHandler?: () => void;
}

interface BlobListInfo {
  blobList: BlobLink[];
  message?: {
    statusCode: number;
  };
}

interface RecentlyViewed {
  blobList: BlobLink[];
}

interface RecentBlobsProps {
  blobListInfo: BlobListInfo;
  blobDetailUrl: string;
  recentlyViewed: RecentlyViewed;
}

export function RecentBlobs({ blobListInfo, blobDetailUrl, recentlyViewed }: RecentBlobsProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Map doctype to FontAwesome icon
  const getDoctypeIcon = (doctype: string): IconDefinition => {
    const doctypeLower = doctype.toLowerCase();
    const iconMap: Record<string, IconDefinition> = {
      note: faStickyNote,
      image: faImage,
      video: faVideo,
      blob: faFile,
      node: faFile,
      bookmark: faFile,
      collection: faFile,
      drill: faFile,
    };
    return iconMap[doctypeLower] || faFile;
  };

  const trigger = (
    <span
      className="top-search-icon"
      data-bs-toggle="tooltip"
      data-placement="bottom"
      title="Recent Blobs"
    >
      <FontAwesomeIcon className="top-search-target glow" icon={faObjectGroup} />
    </span>
  );

  return (
    <span className="mx-2">
      <Popover
        trigger={trigger}
        placement="bottom-end"
        offsetDistance={8}
        className="recent-blobs-popover"
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <div className="recent-blobs-content">
          <div className="recent-blobs-section">
            <div className="recent-blobs-title">Recently Viewed</div>
            {recentlyViewed.blobList.length > 0 ? (
              <ul className="recent-blobs-list">
                {recentlyViewed.blobList.map((link) => (
                  <li key={link.uuid} className="recent-blobs-item">
                    <a
                      href={link.url}
                      className="recent-blobs-link"
                      onClick={link.clickHandler ? (e) => {
                        e.preventDefault();
                        link.clickHandler?.();
                        setIsOpen(false);
                      } : () => setIsOpen(false)}
                    >
                      <span className={`recent-blobs-doctype doctype-${link.doctype.toLowerCase()}`}>
                        <FontAwesomeIcon icon={getDoctypeIcon(link.doctype)} />
                      </span>
                      <span className="recent-blobs-name">{link.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="recent-blobs-empty">
                Nothing recently viewed
              </div>
            )}
            {blobListInfo.message && (
              <div className="recent-blobs-error">
                <strong>Elasticsearch Error</strong>: {blobListInfo.message.statusCode}
              </div>
            )}
          </div>
        </div>
      </Popover>
    </span>
  );
}

export default RecentBlobs;
