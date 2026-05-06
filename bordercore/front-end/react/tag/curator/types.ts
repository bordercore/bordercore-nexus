export interface AliasRow {
  uuid: string;
  name: string;
}

export interface RelatedTag {
  tag_name: string;
  count: number;
}

export interface CountCell {
  label: string;
  icon: string;
  count: number;
}

export type CountKey =
  | "blob" | "bookmark" | "album" | "collection"
  | "todo" | "question" | "song";

export interface TagSnapshot {
  name: string;
  created: string;          // ISO date
  user: string;
  pinned: boolean;
  meta: boolean;
  counts: Record<CountKey, CountCell>;
  aliases: AliasRow[];
  related: RelatedTag[];
}

export interface AliasLibraryRow {
  uuid: string;
  name: string;
  tag: string;
}

export interface TagBootstrap {
  active_name: string;
  tag: TagSnapshot;
  alias_library: AliasLibraryRow[];
  tag_names: string[];
}

export interface CuratorUrls {
  // Read
  tagDetailBase: string;       // "/tag/" — append "<name>/" to switch active tag
  tagSearchUrl: string;        // /tag/search?query=
  tagSnapshotUrl: string;      // /tag/<name>/snapshot.json
  // Write
  pinUrl: string;              // POST {tag}
  unpinUrl: string;            // POST {tag}
  setMetaUrl: string;          // POST {tag, value}
  addAliasUrl: string;         // POST {tag_name, alias_name}
  tagAliasDetailUrl: string;   // /api/tagaliases/<uuid>/  (DELETE)
}
