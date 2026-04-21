import React from "react";

export type ActiveFilter =
  | { type: "all" }
  | { type: "tag"; value: string }
  | { type: "priority"; value: string }
  | { type: "created"; value: string }
  | { type: "search"; value: string };

interface TodoBreadcrumbProps {
  filter: ActiveFilter;
}

const KIND_LABEL: Record<Exclude<ActiveFilter["type"], "all">, string> = {
  tag: "Tag",
  priority: "Priority",
  created: "Created",
  search: "Search",
};

export function TodoBreadcrumb({ filter }: TodoBreadcrumbProps) {
  if (filter.type === "all") {
    return (
      <h1 className="refined-breadcrumb-h1 todo-breadcrumb">
        <span className="current neutral">All Tasks</span>
      </h1>
    );
  }

  return (
    <h1 className="refined-breadcrumb-h1 todo-breadcrumb">
      <span className="dim">{KIND_LABEL[filter.type]}</span>
      <span className="sep">/</span>
      <span className="current">{filter.value}</span>
    </h1>
  );
}

export default TodoBreadcrumb;
