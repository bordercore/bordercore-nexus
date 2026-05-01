export type Doctype = "note" | "book" | "image" | "video" | "document" | "blob";

export type DateBucket = "today" | "this-week" | "last-week" | "this-month" | "older";

export const DOCTYPES: Doctype[] = ["note", "book", "image", "video", "document", "blob"];

export const DATE_BUCKETS: DateBucket[] = [
  "today",
  "this-week",
  "last-week",
  "this-month",
  "older",
];

export const DATE_BUCKET_LABELS: Record<DateBucket, string> = {
  today: "today",
  "this-week": "this week",
  "last-week": "last week",
  "this-month": "this month",
  older: "older",
};

export const DOCTYPE_LABELS: Record<Doctype, string> = {
  note: "Notes",
  book: "Books",
  image: "Images",
  video: "Videos",
  document: "Documents",
  blob: "Files",
};

export interface DashboardBlob {
  uuid: string;
  name: string;
  url: string;
  external_url: string;
  doctype: Doctype;
  tags: string[];
  bucket: DateBucket;
  created_rel: string;
  importance: number;
  is_starred: boolean;
  is_pinned: boolean;
  cover_url: string;
  content: string;
  back_refs: number;
  size: string;
  num_pages: number;
  duration: string;
  content_type: string;
}

export interface TagCount {
  name: string;
  count: number;
}

export interface DoctypeCounts {
  all: number;
  note: number;
  book: number;
  image: number;
  video: number;
  document: number;
  blob: number;
}

export type DateBucketCounts = Record<DateBucket, number>;

export interface DashboardData {
  blobs: DashboardBlob[];
  total_count: number;
  doctype_counts: DoctypeCounts;
  tag_counts: TagCount[];
  tag_total: number;
  date_bucket_counts: DateBucketCounts;
  starred_count: number;
  pinned_count: number;
}

export interface DashboardUrls {
  createBlob: string;
  importBlob: string;
  bookshelf: string;
}

export type DoctypeFilter = "all" | Doctype;

export interface FilterState {
  doctype: DoctypeFilter;
  tags: Set<string>;
  dateBucket: DateBucket | null;
  starredOnly: boolean;
  pinnedOnly: boolean;
}

export const EMPTY_FILTERS: FilterState = {
  doctype: "all",
  tags: new Set<string>(),
  dateBucket: null,
  starredOnly: false,
  pinnedOnly: false,
};
