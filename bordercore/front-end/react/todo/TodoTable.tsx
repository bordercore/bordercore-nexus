import React, { useState, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGripVertical,
  faLink,
  faStickyNote,
  faArrowUp,
  faPencilAlt,
  faTrashAlt,
  faAngleUp,
  faAngleDown,
} from "@fortawesome/free-solid-svg-icons";
import MarkdownIt from "markdown-it";
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
  onDrop: (todoUuid: string, newPosition: number) => void;
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

export function TodoTable({
  items,
  defaultSort,
  isSortable,
  onSort,
  onDrop,
  onMoveToTop,
  onEdit,
  onDelete,
}: TodoTableProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
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

  const handleSort = useCallback((field: SortField) => {
    let newDirection: "asc" | "desc";
    if (sortField === field) {
      newDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      newDirection = "asc";
    }
    setSortField(field);
    setSortDirection(newDirection);
    onSort(field, newDirection);
  }, [sortField, sortDirection, onSort]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return (
      <FontAwesomeIcon
        icon={sortDirection === "asc" ? faAngleUp : faAngleDown}
        className="ms-1 sort-icon"
      />
    );
  };

  // Drag and drop handlers - using drag handle approach
  const handleDragStart = useCallback((e: React.DragEvent<HTMLSpanElement>, index: number) => {
    // Find the parent row element
    const row = (e.target as HTMLElement).closest("tr");
    if (row) {
      // Set drag image to the row
      e.dataTransfer.setDragImage(row, 0, 0);
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
    setDraggingIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggingIndex !== index) {
      setDragOverIndex(index);
    }
  }, [draggingIndex]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDropOnRow = useCallback((e: React.DragEvent<HTMLTableRowElement>, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(dragIndex) && dragIndex !== dropIndex) {
      const todo = sortedItems[dragIndex];
      // Position is 1-indexed
      onDrop(todo.uuid, dropIndex + 1);
    }
    setDraggingIndex(null);
    setDragOverIndex(null);
  }, [sortedItems, onDrop]);

  const canDrag = isSortable && sortField === "sort_order" && sortDirection === "asc";

  const renderNoteTooltip = (todo: Todo) => {
    return markdown.render(todo.note);
  };

  if (items.length === 0) {
    return (
      <div className="text-center p-3">No tasks found</div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table table-hover">
        <thead>
          <tr>
            <th
              className="todo-col-manual-sorting text-center cursor-pointer"
              onClick={() => handleSort("sort_order")}
            >
              Manual{renderSortIcon("sort_order")}
            </th>
            <th
              className="cursor-pointer"
              onClick={() => handleSort("name")}
            >
              Name{renderSortIcon("name")}
            </th>
            <th
              className="todo-col-priority cursor-pointer"
              onClick={() => handleSort("priority")}
            >
              Priority{renderSortIcon("priority")}
            </th>
            <th
              className="todo-col-date cursor-pointer"
              onClick={() => handleSort("created_unixtime")}
            >
              Date{renderSortIcon("created_unixtime")}
            </th>
            <th className="col-action"></th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((todo, index) => (
            <tr
              key={todo.uuid}
              className={`hover-target ${dragOverIndex === index ? "drag-over" : ""} ${draggingIndex === index ? "dragging" : ""}`}
              onDragOver={canDrag ? (e) => handleDragOver(e, index) : undefined}
              onDragLeave={canDrag ? handleDragLeave : undefined}
              onDrop={canDrag ? (e) => handleDropOnRow(e, index) : undefined}
            >
              <td className="todo-col-manual-sorting text-center">
                <span
                  className={`drag-handle ${canDrag ? "drag-handle-active" : ""}`}
                  draggable={canDrag}
                  onDragStart={canDrag ? (e) => handleDragStart(e, index) : undefined}
                  onDragEnd={canDrag ? handleDragEnd : undefined}
                >
                  <FontAwesomeIcon icon={faGripVertical} />
                </span>
              </td>
              <td>
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
                      <span
                        title={todo.note}
                        data-bs-toggle="tooltip"
                        data-bs-html="true"
                      >
                        <FontAwesomeIcon icon={faStickyNote} className="glow text-primary" />
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td className="todo-col-priority">
                {todo.priority_name}
              </td>
              <td className="todo-col-date text-nowrap">
                {getFormattedDate(todo.created)}
              </td>
              <td className="col-action">
                <DropDownMenu
                  showOnHover={true}
                  dropdownSlot={
                    <ul className="dropdown-menu-list">
                      {isSortable && todo.sort_order > 1 && (
                        <li>
                          <button
                            className="dropdown-menu-item"
                            onClick={() => onMoveToTop(todo)}
                          >
                            <span className="dropdown-menu-icon">
                              <FontAwesomeIcon icon={faArrowUp} />
                            </span>
                            <span className="dropdown-menu-text">Move To Top</span>
                          </button>
                        </li>
                      )}
                      <li>
                        <button
                          className="dropdown-menu-item"
                          onClick={() => onEdit(todo)}
                        >
                          <span className="dropdown-menu-icon">
                            <FontAwesomeIcon icon={faPencilAlt} />
                          </span>
                          <span className="dropdown-menu-text">Edit</span>
                        </button>
                      </li>
                      <li>
                        <button
                          className="dropdown-menu-item"
                          onClick={() => onDelete(todo)}
                        >
                          <span className="dropdown-menu-icon">
                            <FontAwesomeIcon icon={faTrashAlt} />
                          </span>
                          <span className="dropdown-menu-text">Delete</span>
                        </button>
                      </li>
                    </ul>
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TodoTable;
