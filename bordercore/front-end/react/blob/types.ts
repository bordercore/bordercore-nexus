// TypeScript interfaces for Blob List page

export interface Book {
  uuid: string;
  name: string;
  url: string;
  cover_url: string;
  author?: string;
  year?: string;
  created?: string;
  date?: string;
  tags?: string[];
}

export interface BookshelfTag {
  name: string;
  count: number;
}

export interface BookshelfCategory {
  id: string;
  label: string;
  tags: BookshelfTag[];
}

export interface RecentBook {
  uuid: string;
  name: string;
  author: string;
  year: string;
  created: string;
  cover_url: string;
  tags: string[];
  url: string;
}

export interface SelectedTagMeta {
  tag: string;
  count: number;
  category: string;
  category_id: string;
}

export interface BookshelfPageProps {
  books: Book[];
  tagList: BookshelfTag[];
  categories: BookshelfCategory[];
  recentBooks: RecentBook[];
  selectedTagMeta: SelectedTagMeta | null;
  totalCount: number;
  searchTerm: string | null;
  selectedTag: string | null;
  clearUrl: string;
  bookshelfUrl: string;
}

// Types for Blob Detail page

export interface BlobDetail {
  uuid: string;
  name: string;
  editionString?: string;
  subtitle?: string;
  author?: string;
  date?: string;
  note?: string;
  content?: string;
  sha1sum?: string;
  isNote: boolean;
  isVideo: boolean;
  isImage: boolean;
  isPdf: boolean;
  isAudio: boolean;
  mathSupport: boolean;
  hasBeenModified: boolean;
  modified?: string;
  created?: string;
  doctype?: string;
  isIndexed?: boolean;
  coverUrl?: string;
  fileUrl?: string;
  tags: Array<{ name: string; url: string }>;
}

export interface BlobDetailUrls {
  edit: string;
  clone: string;
  create: string;
  list: string;
  delete: string;
  getElasticsearchInfo: string;
  relatedObjects: string;
  addRelatedObject: string;
  removeRelatedObject: string;
  sortRelatedObjects: string;
  editRelatedObjectNote: string;
  collectionSearch: string;
  addToCollection: string;
  createCollection: string;
  pinNote: string;
  searchNames: string;
  kbSearchTagDetail: string;
  awsUrl?: string;
  sqlPlayground?: string;
  pdfViewer?: string;
  rename?: string;
  visualize?: string;
}

export interface RelatedObjectItem {
  bc_object_uuid?: string;
  uuid: string;
  type: string;
  name?: string;
  url?: string;
  cover_url?: string;
  note?: string;
}

export interface SearchResult {
  uuid: string;
  name?: string;
  question?: string;
  doctype?: string;
  type?: string;
  url?: string;
  cover_url?: string;
  num_objects?: number;
}

export interface Collection {
  uuid: string;
  name: string;
  url: string;
  coverUrl: string;
  numObjects: number;
  note?: string;
}

export interface ElasticsearchInfo {
  contentType?: string;
  size?: string;
  numPages?: number;
  duration?: string;
}

export interface TreeNode {
  id: number;
  label: string;
  nodes: TreeNode[];
}

export interface TreeData {
  label: string;
  nodes: TreeNode[];
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

export interface NodeInfo {
  uuid: string;
  name: string;
  url: string;
}

export interface BlobDetailPageProps {
  blob: BlobDetail;
  urls: BlobDetailUrls;
  blobUrls: Array<{ url: string; domain: string }>;
  initialCollectionList: Collection[];
  initialElasticsearchInfo: ElasticsearchInfo | null;
  backReferences: BackReference[];
  tree: TreeData;
  metadataMisc: Record<string, string>;
  nodeList: NodeInfo[];
  isPinnedNote: boolean;
}
