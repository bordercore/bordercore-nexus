import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type {
  Todo,
  Tag,
  PriorityOption,
  TimeOption,
  SortState,
  TodoListResponse,
  ViewType,
} from "./types";
import { NewTodoModal } from "./NewTodoModal";
import { EditTodoModal, EditTodoInfo } from "./EditTodoModal";
import { doPost, doDelete, EventBus } from "../utils/reactUtils";
import TodoFilterSidebar, { FilterValue } from "./TodoFilterSidebar";
import TodoFilterTitle, { ActiveFilter } from "./TodoFilterTitle";
import TodoToolbar, { SortField } from "./TodoToolbar";
import TodoRow from "./TodoRow";

const VIEW_STORAGE_KEY = "todo_view_density";
const SORT_STORAGE_KEY = "todo_sort_field";
const SEARCH_DEBOUNCE_MS = 200;

function filterFromUrl(): FilterValue | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const tag = params.get("tag");
  if (tag) return { type: "tag", value: tag };
  const priority = params.get("priority");
  if (priority) return { type: "priority", value: priority };
  const created = params.get("created");
  if (created) return { type: "created", value: created };
  // "all" only wins if the URL explicitly asks for it (so Django's session
  // filter still takes effect on first load when no URL params are present).
  if (params.get("all") === "1") return { type: "all" };
  return null;
}

function searchFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

function syncUrl(filter: FilterValue, search: string) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (filter.type === "tag") params.set("tag", filter.value);
  else if (filter.type === "priority") params.set("priority", filter.value);
  else if (filter.type === "created") params.set("created", filter.value);
  else if (filter.type === "all") params.set("all", "1");
  if (search) params.set("q", search);
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  if (next !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, "", next);
  }
}

interface TodoListPageProps {
  getTasksUrl: string;
  sortUrl: string;
  moveToTopUrl: string;
  editTodoUrl: string;
  createTodoUrl: string;
  tagSearchUrl: string;
  storeInSessionUrl: string;
  priorityList: [number, string][];
  tags: Tag[];
  initialFilters: {
    tag: string;
    priority: string;
    time: string;
  };
  defaultSort: SortState;
  initialUuid?: string;
  initialViewType: ViewType;
}

function filterFromInitial(f: TodoListPageProps["initialFilters"]): FilterValue {
  if (f.tag) return { type: "tag", value: f.tag };
  if (f.priority) return { type: "priority", value: f.priority };
  if (f.time) return { type: "created", value: f.time };
  return { type: "all" };
}

function readStoredView(fallback: ViewType): ViewType {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "normal" || stored === "compact") return stored;
  } catch {
    // ignore storage errors
  }
  return fallback;
}

function readStoredSort(fallback: SortField): SortField {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    if (
      stored === "sort_order" ||
      stored === "name" ||
      stored === "priority" ||
      stored === "created_unixtime"
    ) {
      return stored;
    }
  } catch {
    // ignore storage errors
  }
  return fallback;
}

export function TodoListPage({
  getTasksUrl,
  sortUrl,
  moveToTopUrl,
  editTodoUrl,
  createTodoUrl,
  tagSearchUrl,
  storeInSessionUrl,
  priorityList,
  tags,
  initialFilters,
  defaultSort,
  initialUuid,
  initialViewType,
}: TodoListPageProps) {
  const [items, setItems] = useState<Todo[]>([]);
  const [active, setActive] = useState<FilterValue>(
    () => filterFromUrl() ?? filterFromInitial(initialFilters)
  );
  const initialSearch = searchFromUrl();
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [activeSearch, setActiveSearch] = useState(initialSearch);
  const [priorityOptions, setPriorityOptions] = useState<PriorityOption[]>([]);
  const [timeOptions, setTimeOptions] = useState<TimeOption[]>([]);
  const [view, setView] = useState<ViewType>(readStoredView(initialViewType));
  const [sortField, setSortField] = useState<SortField>(
    readStoredSort(defaultSort.field as SortField)
  );

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newModalSeed, setNewModalSeed] = useState<{ tags: string[]; priority: number }>({
    tags: [],
    priority: 3,
  });
  const [editTodo, setEditTodo] = useState<EditTodoInfo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const isSortable = useMemo(
    () => active.type === "tag" && activeSearch === "",
    [active, activeSearch]
  );
  const canDrag = isSortable && sortField === "sort_order";

  const breadcrumbFilter: ActiveFilter = useMemo(() => {
    if (activeSearch) return { type: "search", value: activeSearch };
    if (active.type === "priority") {
      const opt = priorityOptions.find(p => String(p[0]) === active.value);
      return { type: "priority", value: opt ? opt[1] : active.value };
    }
    if (active.type === "created") {
      const opt = timeOptions.find(t => t[0] === active.value);
      return { type: "created", value: opt ? opt[1] : active.value };
    }
    if (active.type === "tag") return { type: "tag", value: active.value };
    return { type: "all" };
  }, [active, activeSearch, priorityOptions, timeOptions]);

  const totalCount = useMemo(() => tags.reduce((sum, t) => sum + t.count, 0), [tags]);

  const fetchTodos = useCallback(
    (uuid?: string) => {
      const params = new URLSearchParams();
      params.append("tag", active.type === "tag" ? active.value : "");
      params.append("priority", active.type === "priority" ? active.value : "");
      params.append("time", active.type === "created" ? active.value : "");
      params.append("search", activeSearch);

      axios
        .get<TodoListResponse>(`${getTasksUrl}?${params.toString()}`)
        .then(response => {
          setItems(response.data.todo_list);
          setPriorityOptions(response.data.priority_counts);
          setTimeOptions(response.data.created_counts);
          if (uuid) {
            const todo = response.data.todo_list.find(x => x.uuid === uuid);
            if (todo) handleEdit(todo);
          }
        })
        .catch(error => {
          console.error("Error getting todo list:", error);
          EventBus.$emit("toast", {
            title: "Error",
            body: "Error getting todo list",
            variant: "danger",
          });
        });
    },
    // handleEdit is stable below; intentionally omitted
    [getTasksUrl, active, activeSearch]
  );

  // Initial load
  useEffect(() => {
    fetchTodos(initialUuid);
  }, []);

  // Refetch when filter or active search changes (skip initial render)
  const isInitial = useRef(true);
  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }
    fetchTodos();
  }, [active, activeSearch, fetchTodos]);

  // Debounce search input into activeSearch
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setActiveSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  // Mirror filter + active search into the URL
  useEffect(() => {
    syncUrl(active, activeSearch);
  }, [active, activeSearch]);

  // Respond to browser back/forward by re-reading the URL
  useEffect(() => {
    const onPop = () => {
      const fromUrl = filterFromUrl();
      if (fromUrl) setActive(fromUrl);
      const q = searchFromUrl();
      setSearchInput(q);
      setActiveSearch(q);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleSelectFilter = useCallback((filter: FilterValue) => {
    setSearchInput("");
    setActiveSearch("");
    setActive(filter);
  }, []);

  const handleSortChange = useCallback(
    (field: SortField) => {
      setSortField(field);
      try {
        localStorage.setItem(SORT_STORAGE_KEY, field);
      } catch {
        // ignore storage errors
      }
      const direction: "asc" | "desc" = field === "sort_order" ? "asc" : "asc";
      doPost(storeInSessionUrl, { todo_sort: JSON.stringify({ field, direction }) }, () => {});
    },
    [storeInSessionUrl]
  );

  const handleViewChange = useCallback(
    (v: ViewType) => {
      setView(v);
      try {
        localStorage.setItem(VIEW_STORAGE_KEY, v);
      } catch {
        // ignore storage errors
      }
      doPost(storeInSessionUrl, { todo_view_type: v }, () => {});
    },
    [storeInSessionUrl]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active: dragged, over } = event;
      if (!over || dragged.id === over.id) return;
      if (active.type !== "tag") return;

      const oldIndex = items.findIndex(i => i.uuid === dragged.id);
      const newIndex = items.findIndex(i => i.uuid === over.id);
      const next = arrayMove(items, oldIndex, newIndex);
      setItems(next);
      doPost(
        sortUrl,
        {
          todo_uuid: dragged.id as string,
          position: String(newIndex + 1),
          tag: active.value,
        },
        () => fetchTodos()
      );
    },
    [items, active, sortUrl, fetchTodos]
  );

  const handleEdit = useCallback((todo: Todo) => {
    setEditTodo({
      uuid: todo.uuid,
      name: todo.name,
      priority: todo.priority,
      note: todo.note,
      tags: todo.tags,
      url: todo.url || undefined,
      due_date: todo.due_date ? new Date(todo.due_date) : undefined,
    });
  }, []);

  const handleDelete = useCallback(
    (todo: Todo) => {
      doDelete(
        editTodoUrl.replace("00000000-0000-0000-0000-000000000000", todo.uuid),
        () => fetchTodos(),
        "Todo task deleted"
      );
    },
    [editTodoUrl, fetchTodos]
  );

  const handleEditorDelete = useCallback(
    (todoInfo: EditTodoInfo) => {
      if (todoInfo.uuid) {
        doDelete(
          editTodoUrl.replace("00000000-0000-0000-0000-000000000000", todoInfo.uuid),
          () => fetchTodos(),
          "Todo task deleted"
        );
      }
    },
    [editTodoUrl, fetchTodos]
  );

  const handleMoveToTop = useCallback(
    (todo: Todo) => {
      if (active.type !== "tag") return;
      doPost(moveToTopUrl, { tag: active.value, todo_uuid: todo.uuid }, () => fetchTodos());
    },
    [active, moveToTopUrl, fetchTodos]
  );

  const handleCreateTodo = useCallback(() => {
    const initialTagList = active.type === "tag" ? [active.value] : [];
    const initialPriority =
      active.type === "priority" && active.value ? parseInt(active.value, 10) || 3 : 3;
    setNewModalSeed({ tags: initialTagList, priority: initialPriority });
    setNewModalOpen(true);
  }, [active]);

  const sortedItems = useMemo(() => {
    if (sortField === "sort_order" && canDrag) return items;
    const copy = [...items];
    copy.sort((a, b) => {
      switch (sortField) {
        case "sort_order":
          return a.sort_order - b.sort_order;
        case "priority":
          return a.priority - b.priority;
        case "created_unixtime":
          return Number(b.created_unixtime) - Number(a.created_unixtime);
        case "name":
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        default:
          return 0;
      }
    });
    return copy;
  }, [items, sortField, canDrag]);

  const totalFiltered = items.length;
  const subheadPhrase = activeSearch
    ? " · matching search"
    : active.type === "tag"
      ? " · filtered by tag"
      : active.type === "priority"
        ? " · filtered by priority"
        : active.type === "created"
          ? " · filtered by recency"
          : "";
  const showTagsOnRows = active.type !== "tag";

  return (
    <div className={`todo-app view-${view === "compact" ? "compact" : "normal"}`}>
      <div className="todo-shell">
        <TodoFilterSidebar
          tags={tags}
          priorityOptions={priorityOptions}
          timeOptions={timeOptions}
          active={active}
          totalCount={totalCount}
          onSelect={handleSelectFilter}
        />

        <main className="todo-main">
          <div className="todo-head">
            <div className="todo-head-text">
              <TodoFilterTitle filter={breadcrumbFilter} />
              <p className="todo-subhead">
                <span className="count">{totalFiltered}</span>{" "}
                {totalFiltered === 1 ? "task" : "tasks"}
                {subheadPhrase}
              </p>
            </div>
            <button type="button" className="refined-btn primary" onClick={handleCreateTodo}>
              <FontAwesomeIcon icon={faPlus} className="refined-btn-icon" />
              new
            </button>
          </div>

          <TodoToolbar
            search={searchInput}
            view={view}
            sortField={sortField}
            onSearch={setSearchInput}
            onClearSearch={() => setSearchInput("")}
            onViewChange={handleViewChange}
            onSortChange={handleSortChange}
          />

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedItems.map(t => t.uuid)}
              strategy={verticalListSortingStrategy}
            >
              {sortedItems.length === 0 ? (
                <div className="todo-empty">No tasks match your filter.</div>
              ) : (
                <div className="todo-list" role="list">
                  {sortedItems.map(todo => (
                    <TodoRow
                      key={todo.uuid}
                      todo={todo}
                      canDrag={canDrag}
                      isSortable={isSortable}
                      showTags={showTagsOnRows}
                      view={view}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onMoveToTop={handleMoveToTop}
                    />
                  ))}
                </div>
              )}
            </SortableContext>
          </DndContext>
        </main>
      </div>

      <NewTodoModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        createTodoUrl={createTodoUrl}
        tagSearchUrl={tagSearchUrl}
        priorityList={priorityList}
        initialTags={newModalSeed.tags}
        initialPriority={newModalSeed.priority}
        onAdd={() => fetchTodos()}
      />

      <EditTodoModal
        open={editTodo !== null}
        onClose={() => setEditTodo(null)}
        editTodoUrl={editTodoUrl}
        tagSearchUrl={tagSearchUrl}
        priorityList={priorityList}
        todoInfo={editTodo}
        onEdit={() => fetchTodos()}
        onDelete={handleEditorDelete}
      />
    </div>
  );
}

export default TodoListPage;
