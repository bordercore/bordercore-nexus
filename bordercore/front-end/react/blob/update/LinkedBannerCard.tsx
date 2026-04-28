import React from "react";

export interface LinkedBlobInfo {
  uuid: string;
  name: string;
  thumbnail_url?: string;
}

export interface LinkedCollectionInfo {
  uuid: string;
  blobs: Array<{ uuid: string; name: string }>;
}

export interface CollectionInfo {
  uuid: string;
  name: string;
}

interface LinkedBannerCardProps {
  linkedBlob?: LinkedBlobInfo;
  linkedCollection?: LinkedCollectionInfo;
  collectionInfo?: CollectionInfo;
}

export function LinkedBannerCard({
  linkedBlob,
  linkedCollection,
  collectionInfo,
}: LinkedBannerCardProps) {
  if (!linkedBlob && !linkedCollection && !collectionInfo) return null;

  return (
    <div className="be-section">
      {linkedBlob && (
        <div className="be-banner">
          {linkedBlob.thumbnail_url && <img src={linkedBlob.thumbnail_url} alt="" />}
          <div>
            Linking to <a href={`/blob/${linkedBlob.uuid}/`}>{linkedBlob.name || "Blob"}</a>
          </div>
        </div>
      )}

      {collectionInfo && (
        <div className="be-banner">
          <div>
            Adding to collection{" "}
            <a href={`/collection/${collectionInfo.uuid}/`}>{collectionInfo.name}</a>
          </div>
        </div>
      )}

      {linkedCollection && (
        <div className="be-banner">
          <div>
            <div>Linking to a collection containing:</div>
            <ul>
              {linkedCollection.blobs.map(b => (
                <li key={b.uuid}>
                  <a href={`/blob/${b.uuid}/`}>{b.name || "No Name"}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default LinkedBannerCard;
