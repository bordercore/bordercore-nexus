import React from "react";

export type ActiveFilter =
  | { type: "all" }
  | { type: "tag"; value: string }
  | { type: "priority"; value: string }
  | { type: "created"; value: string }
  | { type: "search"; value: string };

interface TodoFilterTitleProps {
  filter: ActiveFilter;
}

const KIND_LABEL: Record<Exclude<ActiveFilter["type"], "all">, string> = {
  tag: "Tag",
  priority: "Priority",
  created: "Created",
  search: "Search",
};

/**
 * Page-title h1 for the todo list that surfaces the active filter
 * (e.g. `Tag / work`, `Priority / 1`). Despite the `.refined-breadcrumb-h1`
 * styling, this is *not* a navigation breadcrumb — none of the spans link
 * anywhere. It's a dynamic title showing which subset of tasks is in view.
 */
export function TodoFilterTitle({ filter }: TodoFilterTitleProps) {
  if (filter.type === "all") {
    return (
      <h1 className="refined-breadcrumb-h1 todo-filter-title">
        <span className="current neutral">All Tasks</span>
      </h1>
    );
  }

  return (
    <h1 className="refined-breadcrumb-h1 todo-filter-title">
      <span className="dim">{KIND_LABEL[filter.type]}</span>
      <span className="sep">/</span>
      <span className="current">{filter.value}</span>
    </h1>
  );
}

export default TodoFilterTitle;
