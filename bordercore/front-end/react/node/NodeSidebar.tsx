import React from "react";
import type { NodeFilter, NodeListItem } from "./types";
import { ARCHIVE_YEAR_CEILING, filtersEqual, yearOf, yearSwatch } from "./nodeListUtils";

interface SideItemProps {
  label: string;
  count: number;
  active: boolean;
  swatch?: string;
  onClick: () => void;
}

function SideItem({ label, count, active, swatch, onClick }: SideItemProps) {
  const style = swatch ? ({ "--swatch": swatch } as React.CSSProperties) : undefined;
  return (
    <button
      type="button"
      className={`nl-nav-item${active ? " active" : ""}`}
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      // must remain inline (per-item --swatch color variable)
      style={style}
    >
      {swatch && <span className="swatch" aria-hidden="true" />}
      <span>{label}</span>
      <span className="count">{count}</span>
    </button>
  );
}

interface NodeSidebarProps {
  nodes: NodeListItem[];
  totalColl: number;
  totalTodo: number;
  filter: NodeFilter;
  onFilterChange: (f: NodeFilter) => void;
}

export function NodeSidebar({
  nodes,
  totalColl,
  totalTodo,
  filter,
  onFilterChange,
}: NodeSidebarProps) {
  const pinnedCount = nodes.filter(n => n.pinned).length;
  const withTodos = nodes.filter(n => n.todo_count > 0).length;
  const empty = nodes.filter(n => n.collection_count === 0 && n.todo_count === 0).length;
  const archiveCount = nodes.filter(n => yearOf(n.modified) <= ARCHIVE_YEAR_CEILING).length;
  const freshCount = nodes.filter(n => yearOf(n.modified) >= 2026).length;

  const byYear = new Map<number, number>();
  for (const n of nodes) {
    const y = yearOf(n.modified);
    byYear.set(y, (byYear.get(y) || 0) + 1);
  }
  const years = Array.from(byYear.entries()).sort((a, b) => b[0] - a[0]);

  const isActive = (f: NodeFilter) => filtersEqual(filter, f);

  return (
    <aside className="nl-sidebar">
      <div>
        <h3>views</h3>
        <div className="nl-nav">
          <SideItem
            label="all nodes"
            count={nodes.length}
            active={isActive({ type: "all" })}
            onClick={() => onFilterChange({ type: "all" })}
          />
          <SideItem
            label="pinned"
            count={pinnedCount}
            swatch="#b36bff"
            active={isActive({ type: "pinned" })}
            onClick={() => onFilterChange({ type: "pinned" })}
          />
          <SideItem
            label="with todos"
            count={withTodos}
            swatch="#f0b840"
            active={isActive({ type: "with-todos" })}
            onClick={() => onFilterChange({ type: "with-todos" })}
          />
          <SideItem
            label="empty"
            count={empty}
            swatch="#5a5f72"
            active={isActive({ type: "empty" })}
            onClick={() => onFilterChange({ type: "empty" })}
          />
          <SideItem
            label="archive"
            count={archiveCount}
            active={isActive({ type: "archive" })}
            onClick={() => onFilterChange({ type: "archive" })}
          />
        </div>
      </div>

      <div>
        <h3>by year</h3>
        <div className="nl-nav">
          {years.map(([y, c]) => (
            <SideItem
              key={y}
              label={String(y)}
              count={c}
              swatch={yearSwatch(y)}
              active={isActive({ type: "year", year: y })}
              onClick={() => onFilterChange({ type: "year", year: y })}
            />
          ))}
        </div>
      </div>

      <div>
        <h3>totals</h3>
        <div className="nl-totals">
          <div className="nl-total">
            <span className="k">collections</span>
            <span className="v">{totalColl}</span>
          </div>
          <div className="nl-total">
            <span className="k">todos</span>
            <span className="v">{totalTodo}</span>
          </div>
          <div className="nl-total nl-total-fresh">
            <span className="k">fresh</span>
            <span className="v">{freshCount}</span>
          </div>
        </div>
      </div>

      <div className="nl-sidebar-footer">
        index refreshed <span className="fresh">just now</span>
        <br />
        {nodes.length} nodes · {totalColl + totalTodo} components
      </div>
    </aside>
  );
}

export default NodeSidebar;
