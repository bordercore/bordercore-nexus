import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faObjectGroup } from "@fortawesome/free-solid-svg-icons";
import DropDownMenu from "../common/DropDownMenu";

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
  return (
    <span className="mx-2" data-bs-toggle="tooltip" data-placement="bottom" title="Recent Blobs">
      <DropDownMenu
        showTarget={false}
        iconSlot={<FontAwesomeIcon className="glow" icon={faObjectGroup} />}
        dropdownSlot={
          <div className="recent-blobs px-2">
            <div className="search-splitter">Recently Viewed</div>
            {recentlyViewed.blobList.length > 0 ? (
              <ul className="interior-borders list-group ps-0">
                {recentlyViewed.blobList.map((link) => (
                  <li key={link.uuid} className="list-group-item ms-0 px-0">
                    <a
                      href={link.url}
                      className="dropdown-item d-flex align-items-center"
                      onClick={link.clickHandler ? (e) => {
                        e.preventDefault();
                        link.clickHandler?.();
                      } : undefined}
                    >
                      <div className={`recent-doctype-${link.doctype.toLowerCase()}`}>{link.doctype}</div>
                      <div className="text-truncate">{link.name}</div>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-warning ms-2 mb-1">
                <hr className="divider mb-1" />
                Nothing recently viewed
              </div>
            )}
            {blobListInfo.message && (
              <div className="text-nowrap">
                <strong>Elasticsearch Error</strong>: {blobListInfo.message.statusCode}
              </div>
            )}
          </div>
        }
      />
    </span>
  );
}

export default RecentBlobs;

