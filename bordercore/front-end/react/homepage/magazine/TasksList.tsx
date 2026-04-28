import React from "react";
import { tagStyle } from "../../utils/tagColors";
import type { Task } from "../types";

interface TasksListProps {
  tasks: Task[];
  todoListUrl: string;
  limit?: number;
}

export function TasksList({ tasks, todoListUrl, limit = 5 }: TasksListProps) {
  const visible = tasks.slice(0, limit);

  if (visible.length === 0) {
    return <div className="mag-empty">All clear — no high-priority tasks.</div>;
  }

  return (
    <ul className="mag-tasks">
      {visible.map(task => (
        <li key={task.uuid} className="mag-task">
          <span className="mag-pdot" aria-hidden="true" />
          <span className="mag-task-name">
            <a href={todoListUrl}>{task.name}</a>
          </span>
          {task.tags.map(tag => (
            <span
              key={tag}
              className="mag-tag"
              style={tagStyle(tag)} // must remain inline
            >
              {tag}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}
