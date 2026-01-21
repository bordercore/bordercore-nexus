import React from "react";
import { createRoot } from "react-dom/client";
import TodoListPage from "../react/todo/TodoListPage";
import type { Tag, SortState } from "../react/todo/types";

const container = document.getElementById("react-root");
if (container) {
  // Get URLs and data from data attributes
  const getTasksUrl = container.getAttribute("data-get-tasks-url") || "";
  const sortUrl = container.getAttribute("data-sort-url") || "";
  const moveToTopUrl = container.getAttribute("data-move-to-top-url") || "";
  const editTodoUrl = container.getAttribute("data-edit-todo-url") || "";
  const createTodoUrl = container.getAttribute("data-create-todo-url") || "";
  const tagSearchUrl = container.getAttribute("data-tag-search-url") || "";
  const storeInSessionUrl = container.getAttribute("data-store-in-session-url") || "";

  // Parse JSON data attributes
  const priorityListJson = container.getAttribute("data-priority-list") || "[]";
  const tagsJson = container.getAttribute("data-tags") || "[]";
  const defaultSortJson = container.getAttribute("data-default-sort") || '{"field":"sort_order","direction":"asc"}';

  // Parse filter values
  const initialTag = container.getAttribute("data-filter-tag") || "";
  const initialPriority = container.getAttribute("data-filter-priority") || "";
  const initialTime = container.getAttribute("data-filter-time") || "";
  const initialUuid = container.getAttribute("data-uuid") || "";

  let priorityList: [number, string][] = [];
  let tags: Tag[] = [];
  let defaultSort: SortState = { field: "sort_order", direction: "asc" };

  try {
    priorityList = JSON.parse(priorityListJson);
  } catch (e) {
    console.error("Error parsing priority list:", e);
  }

  try {
    tags = JSON.parse(tagsJson);
  } catch (e) {
    console.error("Error parsing tags:", e);
  }

  try {
    defaultSort = JSON.parse(defaultSortJson);
  } catch (e) {
    console.error("Error parsing default sort:", e);
  }

  if (getTasksUrl && editTodoUrl && createTodoUrl) {
    const root = createRoot(container);
    root.render(
      <TodoListPage
        getTasksUrl={getTasksUrl}
        sortUrl={sortUrl}
        moveToTopUrl={moveToTopUrl}
        editTodoUrl={editTodoUrl}
        createTodoUrl={createTodoUrl}
        tagSearchUrl={tagSearchUrl}
        storeInSessionUrl={storeInSessionUrl}
        priorityList={priorityList}
        tags={tags}
        initialFilters={{
          tag: initialTag,
          priority: initialPriority,
          time: initialTime,
        }}
        defaultSort={defaultSort}
        initialUuid={initialUuid || undefined}
      />
    );
  } else {
    console.error("TodoListPage: Missing required URLs");
  }
}
