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
}
