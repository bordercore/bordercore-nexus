export interface NoteSummary {
  uuid: string;
  name: string;
  url: string;
  tags: string[];
  importance: number;
  modified_iso: string;
  is_pinned: boolean;
  preview: string;
}

export interface TagCount {
  name: string;
  count: number;
}

export interface NotesLandingTotals {
  pinned: number;
  recents: number;
  tags: number;
}

export interface NotesLandingData {
  pinned: NoteSummary[];
  recents: NoteSummary[];
  tag_counts: TagCount[];
  totals: NotesLandingTotals;
}

export interface NotesLandingUrls {
  createNote: string;
  search: string;
  tagDetail: string;
  sortPinned: string;
}

/** Map raw 1–10 importance into the 0–5 dot scale used by the landing UI. */
export function importanceToDots(importance: number): number {
  if (!importance || importance <= 1) return 0;
  const clamped = Math.min(10, Math.max(1, importance));
  return Math.round(((clamped - 1) / 9) * 5);
}
