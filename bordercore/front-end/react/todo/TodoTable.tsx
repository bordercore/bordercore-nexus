import React, { ReactNode, useState, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGripVertical,
  faLink,
  faArrowUp,
  faPencilAlt,
  faTrashAlt,
  faCalendarAlt,
  faTag,
  faExclamationCircle,
  faList,
  faBars,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Todo, SortState, ViewType } from "./types";
import { getPriorityClass } from "./types";
import DropDownMenu from "../common/DropDownMenu";
import { tagStyle } from "../utils/tagColors";
import MarkdownIt from "markdown-it";

const markdown = MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

type SortField = "sort_order" | "name" | "priority" | "created_unixtime";

interface TodoTableProps {
  items: Todo[];
  defaultSort: SortState;
  isSortable: boolean;
  showTags: boolean;
  viewType: ViewType;
  leftSlot?: ReactNode;
  onSort: (field: string, direction: "asc" | "desc") => void;
  onViewTypeChange: (type: ViewType) => void;
  onMoveToTop: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

function getFormattedDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDueDateLabel(dueDateString: string): { label: string; isOverdue: boolean } {
  const now = new Date();
  const due = new Date(dueDateString);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: "OVERDUE", isOverdue: true };
  if (diffDays === 0) return { label: "TODAY", isOverdue: false };
  if (diffDays === 1) return { label: "Tomorrow", isOverdue: false };
  return {
    label: due.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    isOverdue: false,
  };
}

export function TodoTable({
  items,
  defaultSort,
  isSortable,
  showTags,
  viewType,
  leftSlot,
  onSort,
  onViewTypeChange,
  onMoveToTop,
  onEdit,
  onDelete,
}: TodoTableProps) {
  const [sortField, setSortField] = useState<SortField>(defaultSort.field as SortField);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(defaultSort.direction);

  // Sort items based on current sort state
  // When drag-and-drop is active (sort_order asc + sortable), preserve array order
  // so optimistic reordering from arrayMove isn't undone by stale sort_order values
  const sortedItems = useMemo(() => {
    if (isSortable && sortField === "sort_order" && sortDirection === "asc") {
      return items;
    }
    return [...items].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case "sort_order":
          aVal = a.sort_order;
          bVal = b.sort_order;
          break;
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "priority":
          aVal = a.priority;
          bVal = b.priority;
          break;
        case "created_unixtime":
          aVal = a.created_unixtime;
          bVal = b.created_unixtime;
          break;
        default:
          return 0;
      }

      let comparison = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [items, sortField, sortDirection, isSortable]);

  const handleSort = useCallback(
    (field: SortField) => {
      let newDirection: "asc" | "desc";
      if (sortField === field) {
        newDirection = sortDirection === "asc" ? "desc" : "asc";
      } else {
        newDirection = "asc";
      }
      setSortField(field);
      setSortDirection(newDirection);
      onSort(field, newDirection);
    },
    [sortField, sortDirection, onSort]
  );

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? " \u2191" : " \u2193";
  };

  const canDrag = isSortable && sortField === "sort_order" && sortDirection === "asc";

  const sortOptions: { field: SortField; label: string }[] = [
    { field: "sort_order", label: "Manual" },
    { field: "name", label: "Name" },
    { field: "priority", label: "Priority" },
    { field: "created_unixtime", label: "Date" },
  ];

  const currentSortLabel = sortOptions.find(opt => opt.field === sortField)?.label ?? "Manual";

  return (
    <>
      <div className="todo-table-actions">
        <div className="todo-table-actions__left">{leftSlot}</div>
        <div className="todo-table-actions__right">
          <div className="btn-group" role="group" aria-label="List View">
            <button
              type="button"
              className={`btn btn-primary ${viewType === "normal" ? "active" : ""}`}
              onClick={() => onViewTypeChange("normal")}
              title="Normal view"
            >
              <FontAwesomeIcon icon={faList} />
            </button>
            <button
              type="button"
              className={`btn btn-primary ${viewType === "compact" ? "active" : ""}`}
              onClick={() => onViewTypeChange("compact")}
              title="Compact view"
            >
              <FontAwesomeIcon icon={faBars} />
            </button>
          </div>

          <div className="todo-sort-dropdown">
            <span className="todo-sort-label">Sort by:</span>
            <DropDownMenu
              direction="dropend"
              showTarget={false}
              iconSlot={
                <span className="todo-sort-current">
                  {currentSortLabel}
                  {renderSortIcon(sortField)}
                  <FontAwesomeIcon icon={faChevronDown} className="todo-sort-caret" />
                </span>
              }
              dropdownSlot={
                <ul className="dropdown-menu-list">
                  {sortOptions.map(opt => (
                    <li key={opt.field}>
                      <button
                        className={`dropdown-menu-item ${sortField === opt.field ? "active" : ""}`}
                        onClick={() => handleSort(opt.field)}
                      >
                        <span className="dropdown-menu-text">{opt.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              }
            />
          </div>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="todo-empty-state">No tasks found</div>
      ) : (
        <div className={`todo-cards ${viewType === "compact" ? "compact" : ""}`} role="list">
          {sortedItems.map(todo => (
            <SortableCard
              key={todo.uuid}
              todo={todo}
              canDrag={canDrag}
              isSortable={isSortable}
              showTags={showTags}
              viewType={viewType}
              onMoveToTop={onMoveToTop}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default TodoTable;

// ---------------------------------------------------------------------------

interface SortableCardProps {
  todo: Todo;
  canDrag: boolean;
  isSortable: boolean;
  showTags: boolean;
  viewType: ViewType;
  onMoveToTop: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

function SortableCard({
  todo,
  canDrag,
  isSortable,
  showTags,
  viewType,
  onMoveToTop,
  onEdit,
  onDelete,
}: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.uuid,
    disabled: !canDrag,
  });
  const elRef = useRef<HTMLDivElement | null>(null);

  const refCallback = useCallback(
    (el: HTMLDivElement | null) => {
      setNodeRef(el);
      elRef.current = el;
    },
    [setNodeRef]
  );

  useLayoutEffect(() => {
    const el = elRef.current;
    if (el) {
      el.style.setProperty("--sortable-transform", CSS.Transform.toString(transform) ?? "none");
      el.style.setProperty("--sortable-transition", transition ?? "none");
    }
  }, [transform, transition]);

  const priorityClass = getPriorityClass(todo.priority);
  const dueInfo = todo.due_date ? getDueDateLabel(todo.due_date) : null;

  return (
    <div
      ref={refCallback}
      role="listitem"
      className={`todo-card todo-card--${priorityClass} sortable-row ${isDragging ? "dragging" : ""} ${viewType === "compact" ? "compact" : ""}`}
      onClick={() => onEdit(todo)}
    >
      <div
        className={`todo-card__drag${canDrag ? "" : " todo-card__drag--disabled"}`}
        aria-label={canDrag ? "Drag to reorder" : undefined}
        aria-hidden={canDrag ? undefined : true}
        {...(canDrag ? attributes : {})}
        {...(canDrag ? listeners : {})}
        onClick={e => e.stopPropagation()}
      >
        <FontAwesomeIcon icon={faGripVertical} />
      </div>

      <div className="todo-card__content">
        <div className="todo-card__header">
          <div className="todo-card__name">
            <span className="todo-task-name">{todo.name}</span>
            {todo.url && (
              <a
                href={todo.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
              >
                <FontAwesomeIcon icon={faLink} />
              </a>
            )}
          </div>
          <span className={`todo-card__badge todo-card__badge--${priorityClass}`}>
            <span className="badge-dot" />
            {todo.priority_name}
          </span>
        </div>

        {viewType !== "compact" && todo.note && (
          <div
            className="todo-card__note"
            dangerouslySetInnerHTML={{ __html: markdown.render(todo.note) }}
          />
        )}

        {viewType === "compact" ? (
          <span className="todo-card__compact-date">{getFormattedDate(todo.created)}</span>
        ) : (
          <div className="todo-card__meta">
            {showTags &&
              todo.tags.map(tag => (
                <span
                  key={tag}
                  className="tag"
                  style={tagStyle(tag)} // must remain inline
                >
                  {tag}
                </span>
              ))}
            <span className="todo-card__meta-item">
              <FontAwesomeIcon icon={faCalendarAlt} />
              {getFormattedDate(todo.created)}
            </span>
            {dueInfo && (
              <span
                className={`todo-card__meta-item ${dueInfo.isOverdue ? "todo-card__meta-item--overdue" : ""}`}
              >
                <FontAwesomeIcon icon={faExclamationCircle} />
                {dueInfo.label}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="todo-card__actions" onClick={e => e.stopPropagation()}>
        <DropDownMenu
          dropdownSlot={
            <ul className="dropdown-menu-list">
              {isSortable && todo.sort_order > 1 && (
                <li>
                  <button className="dropdown-menu-item" onClick={() => onMoveToTop(todo)}>
                    <span className="dropdown-menu-icon">
                      <FontAwesomeIcon icon={faArrowUp} />
                    </span>
                    <span className="dropdown-menu-text">Move To Top</span>
                  </button>
                </li>
              )}
              <li>
                <button className="dropdown-menu-item" onClick={() => onEdit(todo)}>
                  <span className="dropdown-menu-icon">
                    <FontAwesomeIcon icon={faPencilAlt} />
                  </span>
                  <span className="dropdown-menu-text">Edit</span>
                </button>
              </li>
              <li>
                <button className="dropdown-menu-item" onClick={() => onDelete(todo)}>
                  <span className="dropdown-menu-icon">
                    <FontAwesomeIcon icon={faTrashAlt} />
                  </span>
                  <span className="dropdown-menu-text">Delete</span>
                </button>
              </li>
            </ul>
          }
        />
      </div>
    </div>
  );
}
