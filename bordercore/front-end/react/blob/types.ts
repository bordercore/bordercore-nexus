// TypeScript interfaces for Blob List page

export interface Book {
  uuid: string;
  name: string;
  url: string;
  cover_url: string;
}

export interface BookshelfTag {
  name: string;
  count: number;
}

export interface BookshelfPageProps {
  books: Book[];
  tagList: BookshelfTag[];
  totalCount: number;
  searchTerm: string | null;
  selectedTag: string | null;
  clearUrl: string;
}

export interface Blob {
  name: string;
  url: string;
  doctype: string;
  cover_url: string | null;
  content: string | null;
  delta_days: number;
  content_size: string;
}

export interface DocTypes {
  all: number;
  note: number;
  image: number;
  document: number;
  blob: number;
}

export interface BlobListData {
  blobList: Blob[];
  docTypes: DocTypes;
}

export type NavItem = "All" | "Notes" | "Images" | "Documents" | "Blobs";

export interface BlobListUrls {
  createBlob: string;
  importBlob: string;
  bookshelf: string;
}

export interface BlobListPageProps {
  blobListData: BlobListData;
  urls: BlobListUrls;
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
  mathSupport: boolean;
  hasBeenModified: boolean;
  modified?: string;
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
  isAdmin: boolean;
  showMetadata: boolean;
  mediaUrl: string;
}
