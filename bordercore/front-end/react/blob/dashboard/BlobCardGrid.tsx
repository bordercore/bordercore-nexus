import React from "react";
import type { DashboardBlob } from "./types";
import NoteCard from "./cards/NoteCard";
import BookCard from "./cards/BookCard";
import ImageCard from "./cards/ImageCard";
import VideoCard from "./cards/VideoCard";
import DocumentCard from "./cards/DocumentCard";

interface BlobCardGridProps {
  blobs: DashboardBlob[];
  onTagClick: (tag: string) => void;
}

export function BlobCardGrid({ blobs, onTagClick }: BlobCardGridProps) {
  return (
    <div className="rb-card-grid">
      {blobs.map(blob => {
        switch (blob.doctype) {
          case "note":
            return <NoteCard key={blob.uuid} blob={blob} onTagClick={onTagClick} />;
          case "book":
            return <BookCard key={blob.uuid} blob={blob} onTagClick={onTagClick} />;
          case "image":
            return <ImageCard key={blob.uuid} blob={blob} onTagClick={onTagClick} />;
          case "video":
            return <VideoCard key={blob.uuid} blob={blob} onTagClick={onTagClick} />;
          default:
            return <DocumentCard key={blob.uuid} blob={blob} onTagClick={onTagClick} />;
        }
      })}
    </div>
  );
}

export default BlobCardGrid;
