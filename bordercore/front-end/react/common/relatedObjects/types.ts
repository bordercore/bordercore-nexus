export type NodeType = "drill" | "blob";

export interface RelatedObject {
  uuid: string;
  name: string;
  url: string;
  edit_url?: string;
  type: string;
  cover_url?: string;
  cover_url_large?: string;
  note?: string;
}

export interface RelatedObjectUrls {
  /** GET — list of related objects for the node. */
  relatedObjects: string;
  /** POST — link an object to the node. */
  add: string;
  /** POST — unlink an object from the node. */
  remove: string;
  /** POST — persist a new ordering. */
  sort: string;
  /** POST — update the relationship note. */
  editNote: string;
}

export interface UseRelatedObjectsConfig {
  objectUuid: string;
  nodeType: NodeType;
  urls: RelatedObjectUrls;
}
