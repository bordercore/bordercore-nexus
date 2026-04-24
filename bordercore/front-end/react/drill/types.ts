export interface DrillUrls {
  drillList: string;
  drillAdd: string;
  startStudySession: string;
  resume: string;
  getPinnedTags: string;
  pinTag: string;
  unpinTag: string;
  sortPinnedTags: string;
  getDisabledTags: string;
  disableTag: string;
  enableTag: string;
  tagSearch: string;
  featuredTagInfo: string;
}

export interface SessionPayload {
  type: string;
  tag?: string | null;
  list: string[];
  current: string;
  completed: number;
  total: number;
  scopeLabel: string;
  nextIn: string | null;
}

export interface StudyScopeItem {
  key: "all" | "review" | "favorites" | "recent" | "random" | "keyword";
  label: string;
  count: number | null;
}

export type ResponseKind = "easy" | "good" | "hard" | "reset";

export interface ProgressBlock {
  pct: number;
  remaining: number;
  total: number;
  reviewedToday: number;
  reviewedWeek: number;
}

export interface ScheduleDay {
  dow: string;
  date: string;
  due: number;
  state: "over" | "today" | "upcoming" | "empty";
}

export interface TagProgressRow {
  name: string;
  progress: number;
  todo: number;
  count: number;
  last_reviewed: string;
  url: string;
  overdueDays: number | null;
  pip: "danger" | "warm" | "cool";
}

export interface PinnedTag {
  name: string;
  progress: number;
  count: number;
  last_reviewed: string;
  url: string;
}

export interface DisabledTag {
  name: string;
  progress: number;
  count: number;
  last_reviewed: string;
  url: string;
}

export interface FeaturedTag {
  name: string;
  progress: number;
  count: number;
  last_reviewed: string;
  url: string;
  histo: number[];
}

export interface RecentResponse {
  question: string;
  response: ResponseKind;
  ago: string;
}

export interface DrillPayload {
  title: string;
  urls: DrillUrls;
  session: SessionPayload | null;
  studyScope: StudyScopeItem[];
  intervals: number[];
  responsesByKind: Record<ResponseKind, number>;
  totalProgress: ProgressBlock;
  favoritesProgress: ProgressBlock;
  schedule: ScheduleDay[];
  tagsNeedingReview: TagProgressRow[];
  pinned: PinnedTag[];
  disabled: DisabledTag[];
  featured: FeaturedTag | null;
  streak: number;
  nextDue: string | null;
  activity28d: number[];
  recentResponses: RecentResponse[];
}
