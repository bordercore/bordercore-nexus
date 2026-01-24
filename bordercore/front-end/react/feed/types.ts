export interface FeedItem {
  id: number;
  link: string;
  title: string;
}

export interface Feed {
  id: number;
  uuid: string;
  name: string;
  lastCheck: string;
  lastResponse: string | null;
  homepage: string | null;
  url: string;
  feedItems: FeedItem[];
}

export interface FeedEditorData {
  uuid?: string;
  name: string;
  url: string;
  homepage: string;
}
