import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faListUl } from "@fortawesome/free-solid-svg-icons";
import type { Tag, PriorityOption, TimeOption } from "./types";
import SideItem from "../common/SideItem";
import { tagSwatchColor } from "../utils/tagColors";

export type FilterValue =
  | { type: "all" }
  | { type: "tag"; value: string }
  | { type: "priority"; value: string }
  | { type: "created"; value: string };

interface TodoFilterSidebarProps {
  tags: Tag[];
  priorityOptions: PriorityOption[];
  timeOptions: TimeOption[];
  active: FilterValue;
  totalCount: number;
  onSelect: (filter: FilterValue) => void;
}

export function TodoFilterSidebar({
  tags,
  priorityOptions,
  timeOptions,
  active,
  totalCount,
  onSelect,
}: TodoFilterSidebarProps) {
  return (
    <aside className="todo-sidebar">
      <div className="refined-side-group">
        <nav className="refined-side-nav">
          <SideItem
            label="All Tasks"
            count={totalCount}
            active={active.type === "all"}
            onClick={() => onSelect({ type: "all" })}
            leadingIcon={<FontAwesomeIcon icon={faListUl} className="leading-icon" />}
          />
        </nav>
      </div>

      {priorityOptions.length > 0 && (
        <div className="refined-side-group">
          <h3>Priority</h3>
          <nav className="refined-side-nav">
            {priorityOptions.map(([value, label, count]) => {
              const stringValue = String(value);
              return (
                <SideItem
                  key={stringValue}
                  label={label}
                  count={count}
                  active={active.type === "priority" && active.value === stringValue}
                  onClick={() => onSelect({ type: "priority", value: stringValue })}
                />
              );
            })}
          </nav>
        </div>
      )}

      {timeOptions.length > 0 && (
        <div className="refined-side-group">
          <h3>Created</h3>
          <nav className="refined-side-nav">
            {timeOptions.map(([value, label, count]) => (
              <SideItem
                key={value}
                label={label}
                count={count}
                active={active.type === "created" && active.value === value}
                onClick={() => onSelect({ type: "created", value })}
              />
            ))}
          </nav>
        </div>
      )}

      {tags.length > 0 && (
        <div className="refined-side-group">
          <h3>Tags</h3>
          <nav className="refined-side-nav">
            {tags.map(tag => (
              <SideItem
                key={tag.name}
                label={tag.name}
                count={tag.count}
                active={active.type === "tag" && active.value === tag.name}
                swatchColor={tagSwatchColor(tag.name)}
                onClick={() => onSelect({ type: "tag", value: tag.name })}
              />
            ))}
          </nav>
        </div>
      )}
    </aside>
  );
}

export default TodoFilterSidebar;
