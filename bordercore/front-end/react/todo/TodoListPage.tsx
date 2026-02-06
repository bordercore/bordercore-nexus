import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faTimes,
  faPlus,
  faStickyNote,
  faLink,
  faEllipsisV,
} from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Todo, Tag, PriorityOption, TimeOption, SortState, TodoListResponse } from "./types";
import TodoFiltersSidebar from "./TodoFiltersSidebar";
import TodoTable from "./TodoTable";
import { TodoEditor, TodoEditorHandle } from "./TodoEditor";
import DropDownMenu from "../common/DropDownMenu";
import { doPost, doDelete, EventBus } from "../utils/reactUtils";

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
}: TodoListPageProps) {
  const [items, setItems] = useState<Todo[]>([]);
  const [filterTag, setFilterTag] = useState(initialFilters.tag);
  const [filterPriority, setFilterPriority] = useState(initialFilters.priority);
  const [filterTime, setFilterTime] = useState(initialFilters.time);
  const [filterSearch, setFilterSearch] = useState("");
  const [currentSearchFilter, setCurrentSearchFilter] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [priorityOptions, setPriorityOptions] = useState<PriorityOption[]>([]);
  const [timeOptions, setTimeOptions] = useState<TimeOption[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filterCacheRef = useRef<{ priority: string; tag: string; time: string } | null>(null);
  const editTodoRef = useRef<TodoEditorHandle>(null);

  // Computed: Is sortable (only with tag filter and no other filters)
  const isSortable = useMemo(() => {
    return filterTime === "" && filterPriority === "" && filterTag !== "";
  }, [filterTime, filterPriority, filterTag]);

  // Computed: Title based on active filters
  const title = useMemo(() => {
    if (currentSearchFilter) {
      return (
        <>
          Results for "<span className="filter-value">{currentSearchFilter}</span>"
        </>
      );
    }
    const parts: React.ReactNode[] = [];
    if (filterTag) {
      parts.push(
        <span key="tag">
          Tag: <span className="filter-value">{filterTag}</span>
        </span>
      );
    }
    if (filterPriority && priorityOptions.length > 0) {
      const priorityIdx = parseInt(filterPriority) - 1;
      if (priorityOptions[priorityIdx]) {
        parts.push(
          <span key="priority">
            Priority: <span className="filter-value">{priorityOptions[priorityIdx][1]}</span>
          </span>
        );
      }
    }
    if (filterTime && timeOptions.length > 0) {
      const timeOption = timeOptions.find(opt => opt[0] === filterTime);
      if (timeOption) {
        parts.push(
          <span key="time">
            Time: <span className="filter-value">{timeOption[1]}</span>
          </span>
        );
      }
    }
    if (parts.length === 0) {
      return "All";
    }
    return parts.reduce(
      (prev, curr, i) =>
        i === 0 ? (
          curr
        ) : (
          <>
            {prev}, {curr}
          </>
        ),
      null as React.ReactNode
    );
  }, [currentSearchFilter, filterTag, filterPriority, filterTime, priorityOptions, timeOptions]);

  // Fetch todo list
  const getTodoList = useCallback(
    (uuid?: string) => {
      const params = new URLSearchParams();
      params.append("tag", filterTag);
      params.append("priority", filterPriority);
      params.append("time", filterTime);
      params.append("search", filterSearch);

      axios
        .get<TodoListResponse>(`${getTasksUrl}?${params.toString()}`)
        .then(response => {
          setItems(response.data.todo_list);
          setPriorityOptions(response.data.priority_counts);
          setTimeOptions(response.data.created_counts);

          // If a uuid is given, open the modal dialog for that todo task
          if (uuid) {
            const todo = response.data.todo_list.find(x => x.uuid === uuid);
            if (todo) {
              handleEdit(todo);
            }
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
    [getTasksUrl, filterTag, filterPriority, filterTime, filterSearch]
  );

  // Initial load
  useEffect(() => {
    getTodoList(initialUuid);
  }, []);

  // Reload when filters change (but not on initial load)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    getTodoList();
  }, [filterTag, filterPriority, filterTime]);

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleTagClick = useCallback(
    (tag: string) => {
      setCurrentSearchFilter("");
      setFilterSearch("");
      setFilterTag(tag);
      if (drawerOpen && window.innerWidth < 992) {
        setDrawerOpen(false);
      }
    },
    [drawerOpen]
  );

  const handlePriorityClick = useCallback(
    (priority: string) => {
      setCurrentSearchFilter("");
      setFilterSearch("");
      setFilterPriority(priority);
      if (drawerOpen && window.innerWidth < 992) {
        setDrawerOpen(false);
      }
    },
    [drawerOpen]
  );

  const handleTimeClick = useCallback(
    (time: string) => {
      setCurrentSearchFilter("");
      setFilterSearch("");
      setFilterTime(time);
      if (drawerOpen && window.innerWidth < 992) {
        setDrawerOpen(false);
      }
    },
    [drawerOpen]
  );

  const handleSearch = useCallback(() => {
    if (filterSearch === "") {
      setCurrentSearchFilter("");
      if (filterCacheRef.current) {
        setFilterPriority(filterCacheRef.current.priority);
        setFilterTag(filterCacheRef.current.tag);
        setFilterTime(filterCacheRef.current.time);
        filterCacheRef.current = null;
      }
    } else {
      setCurrentSearchFilter(filterSearch);
      filterCacheRef.current = {
        priority: filterPriority,
        tag: filterTag,
        time: filterTime,
      };
      setFilterPriority("");
      setFilterTag("");
      setFilterTime("");
    }
    getTodoList();
  }, [filterSearch, filterPriority, filterTag, filterTime, getTodoList]);

  const removeSearchFilter = useCallback(() => {
    setFilterSearch("");
    setCurrentSearchFilter("");
    if (filterCacheRef.current) {
      setFilterPriority(filterCacheRef.current.priority);
      setFilterTag(filterCacheRef.current.tag);
      setFilterTime(filterCacheRef.current.time);
      filterCacheRef.current = null;
    }
    getTodoList();
  }, [getTodoList]);

  const handleSort = useCallback(
    (field: string, direction: "asc" | "desc") => {
      const sort = { field, direction };
      doPost(storeInSessionUrl, { todo_sort: JSON.stringify(sort) }, () => {});
    },
    [storeInSessionUrl]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = items.findIndex(item => item.uuid === active.id);
        const newIndex = items.findIndex(item => item.uuid === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        setItems(newItems);

        doPost(
          sortUrl,
          {
            todo_uuid: active.id as string,
            position: (newIndex + 1).toString(),
            tag: filterTag,
          },
          () => {
            getTodoList();
          }
        );
      }
    },
    [items, filterTag, sortUrl, getTodoList]
  );

  const activeTodo = useMemo(() => {
    return activeId ? items.find(item => item.uuid === activeId) : null;
  }, [activeId, items]);

  const handleMoveToTop = useCallback(
    (todo: Todo) => {
      doPost(
        moveToTopUrl,
        {
          tag: filterTag,
          todo_uuid: todo.uuid,
        },
        () => {
          getTodoList();
        }
      );
    },
    [filterTag, moveToTopUrl, getTodoList]
  );

  const handleEdit = useCallback((todo: Todo) => {
    const todoInfo = {
      uuid: todo.uuid,
      name: todo.name,
      priority: todo.priority,
      note: todo.note,
      tags: todo.tags,
      url: todo.url || undefined,
      due_date: todo.due_date ? new Date(todo.due_date) : undefined,
    };
    editTodoRef.current?.openModal("Edit", todoInfo);
  }, []);

  const handleDelete = useCallback(
    (todo: Todo) => {
      doDelete(
        editTodoUrl.replace("00000000-0000-0000-0000-000000000000", todo.uuid),
        () => {
          getTodoList();
        },
        "Todo task deleted"
      );
    },
    [editTodoUrl, getTodoList]
  );

  // Wrapper for TodoEditor's onDelete which receives TodoInfo instead of Todo
  const handleEditorDelete = useCallback(
    (todoInfo: { uuid?: string }) => {
      if (todoInfo.uuid) {
        doDelete(
          editTodoUrl.replace("00000000-0000-0000-0000-000000000000", todoInfo.uuid),
          () => {
            getTodoList();
          },
          "Todo task deleted"
        );
      }
    },
    [editTodoUrl, getTodoList]
  );

  const handleCreateTodo = useCallback(() => {
    const initialTagList = filterTag ? [filterTag] : [];
    const todoInfo = {
      note: "",
      priority: filterPriority ? parseInt(filterPriority) : 3,
      tags: initialTagList,
    };
    editTodoRef.current?.openModal("Create", todoInfo);
    if (filterTag) {
      editTodoRef.current?.setTags(initialTagList);
    }
  }, [filterTag, filterPriority]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  // When search input is cleared while a search is active, restore previous filters
  useEffect(() => {
    if (filterSearch === "" && currentSearchFilter !== "") {
      removeSearchFilter();
    }
  }, [filterSearch, currentSearchFilter, removeSearchFilter]);

  return (
    <div className="row g-0 h-100 mx-2">
      <TodoFiltersSidebar
        tags={tags}
        priorityOptions={priorityOptions}
        timeOptions={timeOptions}
        filterTag={filterTag}
        filterPriority={filterPriority}
        filterTime={filterTime}
        drawerOpen={drawerOpen}
        onToggleDrawer={toggleDrawer}
        onClickTag={handleTagClick}
        onClickPriority={handlePriorityClick}
        onClickTime={handleTimeClick}
      />

      <div className="col-lg-9">
        <div className="card-grid ms-gutter">
          <div className="d-flex justify-content-between mb-2">
            {/* Filters button for mobile */}
            <button
              type="button"
              className="btn btn-primary todo-filters-drawer-toggle d-lg-none me-2"
              onClick={toggleDrawer}
              aria-label="Toggle Filters"
            >
              <FontAwesomeIcon icon={faBars} className="me-2" />
              Filters
            </button>

            <form className="form-inline" role="form" onSubmit={e => e.preventDefault()}>
              <div className="position-relative">
                <input
                  type="text"
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  className="form-control"
                  placeholder="Search"
                  onKeyDown={handleSearchKeyDown}
                />
                {currentSearchFilter && (
                  <div className="search-input-cancel">
                    <a
                      className="ms-1"
                      href="#"
                      onClick={e => {
                        e.preventDefault();
                        removeSearchFilter();
                      }}
                    >
                      <FontAwesomeIcon icon={faTimes} className="text-primary" />
                    </a>
                  </div>
                )}
              </div>
            </form>

            <div className="card-title ms-3 me-auto">{title}</div>

            <div className="me-2">
              <DropDownMenu
                dropdownSlot={
                  <ul className="dropdown-menu-list">
                    <li>
                      <button className="dropdown-menu-item" onClick={handleCreateTodo}>
                        <span className="dropdown-menu-icon">
                          <FontAwesomeIcon icon={faPlus} />
                        </span>
                        <span className="dropdown-menu-text">New Todo</span>
                      </button>
                    </li>
                  </ul>
                }
              />
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map(item => item.uuid)}
              strategy={verticalListSortingStrategy}
            >
              <TodoTable
                items={items}
                defaultSort={defaultSort}
                isSortable={isSortable}
                onSort={handleSort}
                onMoveToTop={handleMoveToTop}
                onEdit={handleEdit}
                onDelete={handleDelete}
                activeTodo={activeTodo}
              />
            </SortableContext>
            <DragOverlay>
              {activeTodo ? (
                <div className="data-grid-row todo-grid-row data-table-drag-overlay">
                  <div role="cell" className="todo-col-manual drag-handle-cell">
                    <div className="hover-reveal-object">
                      <FontAwesomeIcon icon={faBars} />
                    </div>
                  </div>
                  <div role="cell" className="todo-col-name">
                    <div className="d-flex">
                      <div>
                        {activeTodo.name}
                        {activeTodo.url && (
                          <span>
                            <a
                              className="ms-1"
                              href={activeTodo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <FontAwesomeIcon icon={faLink} />
                            </a>
                          </span>
                        )}
                      </div>
                      <div className="ms-auto">
                        {activeTodo.note && (
                          <span>
                            <FontAwesomeIcon icon={faStickyNote} className="glow text-primary" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div role="cell" className="todo-col-priority">
                    {activeTodo.priority_name}
                  </div>
                  <div role="cell" className="todo-col-date">
                    {new Date(activeTodo.created).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <div role="cell" className="todo-col-actions">
                    <div className="dropdown-wrapper">
                      <div className="dropdown-trigger dropdownmenu">
                        <div className="d-flex align-items-center justify-content-center h-100 w-100">
                          <FontAwesomeIcon icon={faEllipsisV} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      <TodoEditor
        ref={editTodoRef}
        priorityList={priorityList}
        editTodoUrl={editTodoUrl}
        createTodoUrl={createTodoUrl}
        tagSearchUrl={tagSearchUrl}
        onAdd={() => getTodoList()}
        onDelete={handleEditorDelete}
        onEdit={() => getTodoList()}
      />
    </div>
  );
}

export default TodoListPage;
