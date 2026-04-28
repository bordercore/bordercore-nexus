import React from "react";
import { TasksList } from "./TasksList";
import { DailyBookmarksList } from "./DailyBookmarksList";
import type { Bookmark, Task } from "../types";

interface FrontPageColumnProps {
  tasks: Task[];
  todoListUrl: string;
  dailyBookmarks: Bookmark[];
  bookmarkClickUrlTemplate: string;
}

export function FrontPageColumn({
  tasks,
  todoListUrl,
  dailyBookmarks,
  bookmarkClickUrlTemplate,
}: FrontPageColumnProps) {
  const headline =
    tasks.length === 0
      ? "Inbox zero — focus on what matters today"
      : `${tasks.length} high-priority task${tasks.length === 1 ? "" : "s"} await${
          tasks.length === 1 ? "s" : ""
        } attention`;

  return (
    <section className="mag-section">
      <div className="mag-ucase is-pink">front page</div>
      <h2 className="mag-lede">
        <a href={todoListUrl}>{headline}</a>
      </h2>

      <div className="mag-tasks-list">
        <TasksList tasks={tasks} todoListUrl={todoListUrl} />
      </div>

      <div className="mag-block">
        <div className="mag-ucase">today's reading list</div>
        <div className="mag-tasks-list">
          <DailyBookmarksList
            bookmarks={dailyBookmarks}
            bookmarkClickUrlTemplate={bookmarkClickUrlTemplate}
          />
        </div>
      </div>
    </section>
  );
}
