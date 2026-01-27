// Node List Types

export interface NodeListItem {
  uuid: string;
  name: string;
  modified: string;
  collection_count: number;
  todo_count: number;
}

export interface FormField {
  name: string;
  label: string;
  type: "text" | "textarea";
  required: boolean;
  maxLength?: number;
  value?: string;
}

// Layout Component Types

export interface CollectionLayoutItem {
  type: "collection";
  uuid: string;
  name: string;
  collection_type: "ad-hoc" | "permanent";
  display: "list" | "individual";
  rotate: number;
  random_order: boolean;
  limit: number | null;
  count?: number;
}

export interface NoteLayoutItem {
  type: "note";
  uuid: string;
  name: string;
  color: 1 | 2 | 3 | 4;
}

export interface TodoLayoutItem {
  type: "todo";
}

export interface ImageLayoutItem {
  type: "image";
  uuid: string;
  image_uuid: string;
  image_title: string;
  image_url: string;
}

export interface QuoteOptions {
  color: 1 | 2 | 3 | 4;
  rotate: number;
  format: "standard" | "minimal";
  favorites_only: boolean;
}

export interface QuoteLayoutItem {
  type: "quote";
  uuid: string;
  quote_uuid: string;
  options: QuoteOptions;
}

export interface NodeOptions {
  rotate: number;
}

export interface NodeLayoutItem {
  type: "node";
  uuid: string;
  node_uuid: string;
  options: NodeOptions;
}

export type LayoutItem =
  | CollectionLayoutItem
  | NoteLayoutItem
  | TodoLayoutItem
  | ImageLayoutItem
  | QuoteLayoutItem
  | NodeLayoutItem;

// Layout is array of 3 columns, each containing array of items
export type Layout = [LayoutItem[], LayoutItem[], LayoutItem[]];

// Todo item within NodeTodoList
export interface NodeTodoItem {
  uuid: string;
  name: string;
  note: string;
  priority: number;
  url: string | null;
}

// Quote data from API
export interface Quote {
  uuid: string;
  quote: string;
  source: string;
  is_favorite: boolean;
}

// Note/Blob data from API
export interface Note {
  uuid: string;
  name: string;
  content: string;
}

// Node info for nested node preview
export interface NodeInfo {
  uuid: string;
  name: string;
  images: NodeImage[];
  note_count: number;
  todo_count: number;
  random_note: { name: string } | null;
  random_todo: { name: string } | null;
}

export interface NodeImage {
  uuid: string;
  cover_url: string;
  blob_url: string;
}

// Modal state types
export interface NoteModalState {
  isOpen: boolean;
  action: "Add" | "Edit";
  callback: ((note: { name: string; color: 1 | 2 | 3 | 4 }) => void) | null;
  data: { name: string; color: 1 | 2 | 3 | 4 } | null;
}

export interface QuoteModalState {
  isOpen: boolean;
  action: "Add" | "Edit";
  callback: ((options: QuoteOptions) => void) | null;
  data: QuoteOptions | null;
}

export interface NodeModalState {
  isOpen: boolean;
  action: "Add" | "Edit";
  callback: ((options: NodeOptions) => void) | null;
  data: NodeOptions | null;
}

export interface ImageModalState {
  isOpen: boolean;
  imageUrl: string;
}

// Priority option from Todo
export type PriorityOption = [number, string, number?];

// Collection object for ObjectSelect
export interface CollectionObject {
  uuid: string;
  name: string;
  doctype: string;
  url?: string;
  cover_url?: string;
}

// Color options
export const NODE_COLORS = [1, 2, 3, 4] as const;
export type NodeColor = (typeof NODE_COLORS)[number];

// Rotate options for quotes and nodes
export const ROTATE_OPTIONS = [
  { value: -1, display: "Never" },
  { value: 1, display: "Every Minute" },
  { value: 5, display: "Every 5 Minutes" },
  { value: 10, display: "Every 10 Minutes" },
  { value: 30, display: "Every 30 Minutes" },
  { value: 60, display: "Every Hour" },
  { value: 1440, display: "Every Day" },
] as const;

// Quote format options
export const FORMAT_OPTIONS = [
  { value: "standard", display: "Standard" },
  { value: "minimal", display: "Minimal" },
] as const;
