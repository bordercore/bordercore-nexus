export interface Todo {
  uuid: string;
  name: string;
  note: string;
  url: string | null;
  priority: number;
  priority_name: string;
  created: string;
  created_unixtime: number;
  tags: string[];
  due_date: string | null;
  sort_order: number;
}

export interface Tag {
  name: string;
  count: number;
}

// [priority_id, priority_name, count]
export type PriorityOption = [number, string, number];

// [time_key, time_label, count]
export type TimeOption = [string, string, number];

export interface TodoListResponse {
  todo_list: Todo[];
  priority_counts: PriorityOption[];
  created_counts: TimeOption[];
}

export interface FilterState {
  tag: string;
  priority: string;
  time: string;
  search: string;
}

export interface SortState {
  field: string;
  direction: "asc" | "desc";
}
