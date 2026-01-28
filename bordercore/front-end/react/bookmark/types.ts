export interface Bookmark {
  uuid: string;
  name: string;
  url: string;
  created: string | null; // null if duplicate date for UI deduplication
  thumbnail_url?: string;
  favicon_url?: string;
  note?: string;
  video_duration?: string;
  tags: string[];
  linkId?: string; // Computed from uuid for element ID
}

export interface PinnedTag {
  id: number;
  uuid?: string;
  name: string;
  bookmark_count?: number;
}

export interface Pagination {
  num_pages: number;
  page_number: number;
  paginate_by: number;
  previous_page_number: number | null;
  next_page_number: number | null;
  range: number[];
}

export interface BookmarkListResponse {
  bookmarks: Bookmark[];
  pagination: Pagination;
}

export interface BackReference {
  uuid: string;
  type: "question" | "blob";
  question?: string;
  name?: string;
  url: string;
  cover_url?: string;
  tags: string[];
}

export interface RelatedNode {
  uuid: string;
  name: string;
  url: string;
}

export interface RelatedTagInfo {
  tag_name: string;
  count: number;
}

export interface TagListItem {
  name: string;
  related: RelatedTagInfo[];
}

export type ViewType = "normal" | "compact";
