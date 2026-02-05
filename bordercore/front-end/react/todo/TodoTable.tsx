import React, { useState, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faLink,
  faStickyNote,
  faArrowUp,
  faPencilAlt,
  faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
import MarkdownIt from "markdown-it";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Todo, SortState } from "./types";
import DropDownMenu from "../common/DropDownMenu";

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
  onSort: (field: string, direction: "asc" | "desc") => void;
  onMoveToTop: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  activeTodo?: Todo | null;
}

function getFormattedDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function TodoTable({
  items,
  defaultSort,
  isSortable,
  onSort,
  onMoveToTop,
  onEdit,
  onDelete,
  activeTodo,
}: TodoTableProps) {
  const [sortField, setSortField] = useState<SortField>(defaultSort.field as SortField);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(defaultSort.direction);

  // Sort items based on current sort state
  const sortedItems = useMemo(() => {
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
  }, [items, sortField, sortDirection]);

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
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  const canDrag = isSortable && sortField === "sort_order" && sortDirection === "asc";

  const renderNoteTooltip = (todo: Todo) => {
    return markdown.render(todo.note);
  };

  if (items.length === 0) {
    return <div className="text-center p-3">No tasks found</div>;
  }

  return (
    <div className="data-grid-container todo-grid-container">
      <div className="data-grid todo-grid" role="table">
        <div className="data-grid-header todo-grid-header" role="row">
          <div
            role="columnheader"
            className="todo-col-manual cursor-pointer"
            onClick={() => handleSort("sort_order")}
          >
            Manual{renderSortIcon("sort_order")}
          </div>
          <div
            role="columnheader"
            className="todo-col-name cursor-pointer"
            onClick={() => handleSort("name")}
          >
            Name{renderSortIcon("name")}
          </div>
          <div
            role="columnheader"
            className="todo-col-priority cursor-pointer"
            onClick={() => handleSort("priority")}
          >
            Priority{renderSortIcon("priority")}
          </div>
          <div
            role="columnheader"
            className="todo-col-date cursor-pointer"
            onClick={() => handleSort("created_unixtime")}
          >
            Date{renderSortIcon("created_unixtime")}
          </div>
          <div role="columnheader" className="todo-col-actions"></div>
        </div>
        <div className="data-grid-body todo-grid-body" role="rowgroup">
          {sortedItems.map((todo, index) => (
            <SortableRow
              key={todo.uuid}
              todo={todo}
              index={index}
              canDrag={canDrag}
              isSortable={isSortable}
              onMoveToTop={onMoveToTop}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default TodoTable;

interface SortableRowProps {
  todo: Todo;
  index: number;
  canDrag: boolean;
  isSortable: boolean;
  onMoveToTop: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

function SortableRow({
  todo,
  canDrag,
  isSortable,
  onMoveToTop,
  onEdit,
  onDelete,
}: SortableRowProps) {
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
      el.style.setProperty(
        "--sortable-transform",
        transform ? CSS.Transform.toString(transform) : "none"
      );
      el.style.setProperty("--sortable-transition", transition ?? "none");
    }
  }, [transform, transition]);

  return (
    <div
      ref={refCallback}
      role="row"
      className={`data-grid-row todo-grid-row sortable-row hover-target hover-reveal-target sortable-todo-row ${isDragging ? "dragging" : ""} ${!canDrag ? "no-drag" : ""}`}
    >
      <div
        role="cell"
        className="todo-col-manual drag-handle-cell"
        {...(canDrag ? { ...attributes, ...listeners } : {})}
        onClick={e => e.stopPropagation()}
      >
        <div className="hover-reveal-object">
          <FontAwesomeIcon icon={faBars} />
        </div>
      </div>
      <div role="cell" className="todo-col-name">
        <div className="d-flex">
          <div>
            {todo.name}
            {todo.url && (
              <span>
                <a className="ms-1" href={todo.url} target="_blank" rel="noopener noreferrer">
                  <FontAwesomeIcon icon={faLink} />
                </a>
              </span>
            )}
          </div>
          <div className="ms-auto">
            {todo.note && (
              <span title={todo.note} data-bs-toggle="tooltip" data-bs-html="true">
                <FontAwesomeIcon icon={faStickyNote} className="glow text-primary" />
              </span>
            )}
          </div>
        </div>
      </div>
      <div role="cell" className="todo-col-priority">
        {todo.priority_name}
      </div>
      <div role="cell" className="todo-col-date">
        {getFormattedDate(todo.created)}
      </div>
      <div role="cell" className="todo-col-actions">
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
