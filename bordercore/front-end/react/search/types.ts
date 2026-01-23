// Search result from Elasticsearch
export interface SearchSource {
  doctype: string;
  name?: string;
  title?: string;
  question?: string;
  url: string;
  importance?: number;
  date?: string;
  domain?: string;
  creators?: string;
  cover_url?: string;
  description?: string;
  artist?: string;
  artist_uuid?: string;
  uuid?: string;
}

export interface SearchHighlight {
  contents?: string[];
  attachment_content?: string[];
}

export interface SearchMatch {
  source: SearchSource;
  highlight?: SearchHighlight;
  tags_json: string;
}

// Aggregation from Elasticsearch (doctype counts)
export interface Aggregation {
  doctype: string;
  count: number;
}

// Paginator object from Django
export interface Paginator {
  page_number: number;
  num_pages: number;
  has_next: boolean;
  has_previous: boolean;
  next_page_number?: number;
  previous_page_number?: number;
  range: number[];
}

// Tag count tuple [tag_name, count]
export type TagCount = [string, number];

// Doctype count tuple [doctype_key, count, display_name]
export type DoctypeCount = [string, number, string?];

// Tag detail result item
export interface TagDetailMatch {
  uuid: string;
  name?: string;
  title?: string;
  question?: string;
  artist?: string;
  date?: string;
  contents?: string;
  creators?: string;
  cover_url?: string;
  album_artwork_url?: string;
  object_url: string;
  url_domain?: string;
  favicon_url?: string;
  importance?: number;
  tags: Array<{ name: string; url: string }>;
}

// Results grouped by doctype for tag detail page
export interface TagDetailResults {
  blob: TagDetailMatch[];
  book: TagDetailMatch[];
  bookmark: TagDetailMatch[];
  document: TagDetailMatch[];
  note: TagDetailMatch[];
  drill: TagDetailMatch[];
  song: TagDetailMatch[];
  todo: TagDetailMatch[];
  album: TagDetailMatch[];
}

// Doctype mapping for display names
export const DOCTYPE_MAPPING: Record<string, string> = {
  album: "Albums",
  blob: "Blobs",
  book: "Books",
  drill: "Drill",
  note: "Notes",
  bookmark: "Bookmarks",
  todo: "Todo Items",
  song: "Songs",
  document: "Documents",
};
