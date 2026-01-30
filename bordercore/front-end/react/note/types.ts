import type { Paginator } from "../search/types";

export interface NoteSource {
  uuid: string;
  name: string;
  date: string;
  contents: string;
  tags: string[];
}

export interface NoteResult {
  source: NoteSource;
  isExpanded: boolean;
}

export interface PinnedNote {
  uuid: string;
  name: string;
  url: string;
}

export interface NoteListPageProps {
  initialResults: NoteResult[];
  pinnedNotes: PinnedNote[];
  paginator: Paginator | null;
  count: number;
  isSearchResult: boolean;
  urls: NoteListUrls;
}

export interface NoteListUrls {
  notesSearch: string;
  createNote: string;
  noteDetail: string;
  sortPinnedNotes: string;
}
