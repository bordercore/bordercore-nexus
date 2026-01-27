import React from "react";
import type { Tag, PriorityOption, TimeOption } from "./types";

interface TodoFiltersSidebarProps {
  tags: Tag[];
  priorityOptions: PriorityOption[];
  timeOptions: TimeOption[];
  filterTag: string;
  filterPriority: string;
  filterTime: string;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  onClickTag: (tag: string) => void;
  onClickPriority: (priority: string) => void;
  onClickTime: (time: string) => void;
}

export function TodoFiltersSidebar({
  tags,
  priorityOptions,
  timeOptions,
  filterTag,
  filterPriority,
  filterTime,
  drawerOpen,
  onToggleDrawer,
  onClickTag,
  onClickPriority,
  onClickTime,
}: TodoFiltersSidebarProps) {
  const getPriorityClass = (priority: number): string => {
    if (priority === parseInt(filterPriority)) {
      return "selected rounded-sm";
    }
    return "";
  };

  const getTimeClass = (created: string): string => {
    if (created === filterTime) {
      return "selected rounded-sm";
    }
    return "";
  };

  const getTagClass = (tag: string): string => {
    if (tag === filterTag) {
      return "selected rounded-sm";
    }
    return "";
  };

  const handlePriorityClick = (priority: number) => {
    const priorityStr = priority.toString();
    if (filterPriority === priorityStr) {
      onClickPriority("");
    } else {
      onClickPriority(priorityStr);
    }
  };

  const handleTimeClick = (time: string) => {
    if (filterTime === time) {
      onClickTime("");
    } else {
      onClickTime(time);
    }
  };

  const handleTagClick = (tag: string) => {
    if (filterTag === tag) {
      onClickTag("");
    } else {
      onClickTag(tag);
    }
  };

  return (
    <>
      {/* Filters drawer overlay (for mobile) */}
      {drawerOpen && (
        <div
          className="todo-filters-drawer-overlay"
          onClick={onToggleDrawer}
        />
      )}

      {/* Filters section - hidden on small screens, shown in drawer */}
      <div className={`col-lg-3 d-flex flex-column todo-filters-sidebar ${drawerOpen ? "drawer-open" : ""}`}>
        <div className="sticky-top card-body backdrop-filter h-100">
          <h4>Priority</h4>
          {priorityOptions.map((option) => (
            <div
              key={option[0]}
              data-priority={option[0]}
              className={`list-with-counts ps-2 py-1 pe-1 d-flex ${getPriorityClass(option[0])}`}
              onClick={() => handlePriorityClick(option[0])}
            >
              <div>{option[1]}</div>
              <div className="ms-auto me-1">
                <span className="px-2 badge rounded-pill">{option[2]}</span>
              </div>
            </div>
          ))}

          <hr className="divider" />

          <h4>Created</h4>
          {timeOptions.map((option) => (
            <div
              key={option[0]}
              className={`list-with-counts ps-2 py-1 pe-1 d-flex ${getTimeClass(option[0])}`}
              onClick={() => handleTimeClick(option[0])}
            >
              <div>{option[1]}</div>
              <div className="ms-auto me-1">
                <span className="px-2 badge rounded-pill">{option[2]}</span>
              </div>
            </div>
          ))}

          <hr className="divider" />

          <h4>Tags</h4>
          {tags.length > 0 ? (
            tags.map((tag) => (
              <div
                key={tag.name}
                className={`list-with-counts ps-2 py-1 pe-1 d-flex ${getTagClass(tag.name)}`}
                onClick={() => handleTagClick(tag.name)}
              >
                <div>{tag.name}</div>
                <div className="ms-auto me-1">
                  <span className="px-2 badge rounded-pill">{tag.count}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-success">No tags found</div>
          )}
        </div>
      </div>
    </>
  );
}

export default TodoFiltersSidebar;
