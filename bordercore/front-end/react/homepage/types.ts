// Homepage data types

export interface Task {
  uuid: string;
  name: string;
  priority_name: string;
  tags: string[];
}

export interface DrillProgress {
  count: number;
  percentage: number;
}

export interface OverdueExercise {
  uuid: string;
  name: string;
  delta_days: number;
}

export interface Bookmark {
  uuid: string;
  name: string;
  url: string;
  daily?: {
    viewed: string;
  };
}

export interface Song {
  title: string;
  artist: {
    uuid: string;
    name: string;
  };
}

export interface Quote {
  quote: string;
  source: string;
}

export interface RandomImageInfo {
  uuid: string;
  name: string;
  url: string;
}

export interface CollectionBlob {
  uuid: string;
  url: string;
  cover_url: string;
}

export interface DefaultCollection {
  uuid: string;
  name: string;
  blob_list: CollectionBlob[];
}

export interface CalendarEvent {
  count: number;
  start_pretty: string;
  summary: string;
}

// Gallery types

export interface CodeSample {
  language: string;
  code: string;
}

// SQL Playground types

export interface TableInfo {
  cols: string[];
  data: Record<string, any>[];
}

export interface SqlOutput {
  cols: string[];
  data: Record<string, any>[];
}

// Data table types for sortable tables

export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}
