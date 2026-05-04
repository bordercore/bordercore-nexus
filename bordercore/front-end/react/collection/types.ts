// TypeScript interfaces for Collection pages

export interface Collection {
  uuid: string;
  name: string;
  url: string;
  num_objects: number;
  description: string;
  tags: string[];
  modified: string;
  is_favorite: boolean;
  cover_tiles: (string | null)[];
}

export type TagCounts = Record<string, number>;

export interface CollectionDetail {
  uuid: string;
  name: string;
  description: string;
  is_favorite: boolean;
  modified: string;
  object_count: number;
}

export interface ObjectTag {
  id: number;
  tag: string;
  blob_count: number;
}

export interface CollectionObject {
  uuid: string;
  name: string;
  url: string;
  edit_url: string;
  type: "blob" | "bookmark";
  cover_url: string;
  cover_url_large: string;
  favicon_url?: string;
  note?: string;
  tags: string[];
}

export interface PaginatorInfo {
  page_number: number;
  has_next: boolean;
  has_previous: boolean;
  next_page_number: number | null;
  previous_page_number: number | null;
  count: number;
}

// Collection List Page Types

export interface CollectionListUrls {
  createCollection: string;
  tagSearch: string;
}

// Collection Detail Page Types

export interface CollectionDetailUrls {
  getObjectList: string;
  sortObjects: string;
  removeObject: string;
  updateCollection: string;
  deleteCollection: string;
  createBlob: string;
  getBlob: string;
  collectionList: string;
  blobDetail: string;
}

export interface CollectionDetailProps {
  collection: CollectionDetail;
  objectTags: ObjectTag[];
  initialTags: string[];
  urls: CollectionDetailUrls;
  tagSearchUrl: string;
  selectedTag: string | null;
}

// Slideshow Types

export interface SlideShowOptions {
  value: string;
  display: string;
}

export interface SlideShowConfig {
  type: "manual" | "automatic";
  interval: string;
  randomize: boolean;
  tag: string;
}
