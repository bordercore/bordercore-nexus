import React, { useCallback, useLayoutEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGripVertical,
  faLink,
  faCalendarAlt,
  faExclamationCircle,
  faArrowUp,
  faPencilAlt,
  faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Todo, ViewType } from "./types";
import DropDownMenu from "../common/DropDownMenu";
import PriorityBadge from "./PriorityBadge";

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDueInfo(dueDate: string): { label: string; isOverdue: boolean } {
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: "OVERDUE", isOverdue: true };
  if (diffDays === 0) return { label: "TODAY", isOverdue: false };
  if (diffDays === 1) return { label: "Tomorrow", isOverdue: false };
  return {
    label: due.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    isOverdue: false,
  };
}

// Lightweight renderer: preserves line breaks and treats consecutive
// "- "/"* " lines as a bulleted list. A full markdown pass would require
// a sanitizer we don't have on the frontend yet.
function NoteBody({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = (key: string) => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${key}`}>
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    );
    bullets = [];
  };
  lines.forEach((line, i) => {
    const match = line.match(/^\s*[-*]\s+(.*)$/);
    if (match) {
      bullets.push(match[1]);
    } else {
      flushBullets(`${i}`);
      const trimmed = line.trim();
      if (trimmed) {
        blocks.push(<p key={`p-${i}`}>{trimmed}</p>);
      }
    }
  });
  flushBullets("end");
  return <div className="todo-row-desc">{blocks}</div>;
}

interface TodoRowProps {
  todo: Todo;
  canDrag: boolean;
  isSortable: boolean;
  showTags: boolean;
  view: ViewType;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  onMoveToTop: (todo: Todo) => void;
}

export function TodoRow({
  todo,
  canDrag,
  isSortable,
  showTags,
  view,
  onEdit,
  onDelete,
  onMoveToTop,
}: TodoRowProps) {
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

  const dueInfo = todo.due_date ? getDueInfo(todo.due_date) : null;

  return (
    <div
      ref={refCallback}
      role="listitem"
      className={`todo-row sortable-row ${isDragging ? "dragging" : ""}`}
      onClick={() => onEdit(todo)}
    >
      <div
        className={`todo-row-drag${canDrag ? "" : " disabled"}`}
        aria-label={canDrag ? "Drag to reorder" : undefined}
        aria-hidden={canDrag ? undefined : true}
        {...(canDrag ? attributes : {})}
        {...(canDrag ? listeners : {})}
        onClick={e => e.stopPropagation()}
      >
        <FontAwesomeIcon icon={faGripVertical} />
      </div>

      <div className="todo-row-body">
        <div className="todo-row-title">
          <span>{todo.name}</span>
          {todo.url && (
            <a
              className="link"
              href={todo.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              aria-label="Open link"
            >
              <FontAwesomeIcon icon={faLink} />
            </a>
          )}
        </div>

        {view !== "compact" && todo.note && <NoteBody source={todo.note} />}

        <div className="todo-row-meta">
          {showTags &&
            view !== "compact" &&
            todo.tags.map(tag => (
              <span key={tag} className="tag-chip">
                {tag}
              </span>
            ))}
          <span className="meta-item">
            <FontAwesomeIcon icon={faCalendarAlt} />
            {formatDate(todo.created)}
          </span>
          {dueInfo && (
            <span className={`meta-item${dueInfo.isOverdue ? " overdue" : ""}`}>
              <FontAwesomeIcon icon={faExclamationCircle} />
              {dueInfo.label}
            </span>
          )}
        </div>
      </div>

      <div className="todo-row-right">
        <PriorityBadge priority={todo.priority} label={todo.priority_name} />
        <div className="todo-row-actions" onClick={e => e.stopPropagation()}>
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
    </div>
  );
}

export default TodoRow;
