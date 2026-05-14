export type NodeType = "blob" | "bookmark" | "question";

export type EdgeKind = "direct" | "tag" | "collection";

export type Layer = "direct" | "tags" | "collections";

export interface GraphNode {
  uuid: string;
  type: NodeType;
  name: string;
  thumbnail_url?: string;
  detail_url: string;
  degree: number;
  importance?: number;
  // Stable id 0..N-1 assigned by Louvain on the server, sorted by size.
  // null = unclustered (singleton, sub-min-size, or overflow past the palette).
  community: number | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: EdgeKind;
  weight: number;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
  // Mapping of community id (as a string) -> top tag names for that
  // cluster, ranked by TF-IDF. Communities without confident labels are
  // simply absent; callers must default to a generic "Cluster N".
  community_labels: Record<string, string[]>;
}
