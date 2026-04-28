import React from "react";
import { MusicSetlist } from "./MusicSetlist";
import { Bookshelf } from "./Bookshelf";
import { fillUrlTemplate } from "./utils";
import type { DefaultCollection, Song } from "../types";

interface AmbientColumnProps {
  music: Song[];
  artistDetailUrlTemplate: string;
  defaultCollection: DefaultCollection | null;
  collectionDetailUrlTemplate: string;
}

export function AmbientColumn({
  music,
  artistDetailUrlTemplate,
  defaultCollection,
  collectionDetailUrlTemplate,
}: AmbientColumnProps) {
  return (
    <section className="mag-section">
      <div className="mag-ucase is-purple">ambient</div>
      <div className="mag-meta">now spinning</div>

      <div className="mag-tasks-list">
        <MusicSetlist music={music} artistDetailUrlTemplate={artistDetailUrlTemplate} />
      </div>

      {defaultCollection && (
        <div className="mag-block">
          <div className="mag-ucase">
            <a href={fillUrlTemplate(collectionDetailUrlTemplate, defaultCollection.uuid)}>
              {defaultCollection.name.toLowerCase()}
            </a>
          </div>
          <Bookshelf blobs={defaultCollection.blob_list} />
        </div>
      )}
    </section>
  );
}
