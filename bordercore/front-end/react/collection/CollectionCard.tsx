import React from "react";
import type { Collection } from "./types";

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

interface CollectionCardProps {
  collection: Collection;
  onClick: (url: string) => void;
}

export function CollectionCard({ collection, onClick }: CollectionCardProps) {
  const blobCountText = `${collection.num_blobs} ${pluralize("blob", collection.num_blobs)}`;

  return (
    <div
      className="collection-container zoom text-center p-3 cursor-pointer"
      onClick={() => onClick(collection.url)}
    >
      <div className="position-relative collection mx-auto">
        <img src={collection.cover_url} alt={collection.name} />
        <div className="collection-cover-container position-absolute">{blobCountText}</div>
      </div>
      <div className="text-truncate">
        <a href={collection.url}>{collection.name}</a>
      </div>
    </div>
  );
}

export default CollectionCard;
