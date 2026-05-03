export interface FeedItem {
  id: number;
  title: string;
  link: string;
  pubDate: string;
  readAt: string | null;
  summary: string;
  thumbnailUrl: string;
}

export interface Feed {
  id: number;
  uuid: string;
  name: string;
  homepage: string | null;
  url: string;
  lastCheck: string | null;
  lastResponse: string | number | null;
  lastResponseCode: number | null;
  feedItems: FeedItem[];
}

export type FeedStatus = "ok" | "warn" | "danger";

export interface FeedEditorData {
  uuid?: string;
  name: string;
  url: string;
  homepage: string;
}
