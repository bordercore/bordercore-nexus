import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import NodeCard from "./NodeCard";
import NodeToolbar from "./NodeToolbar";
import NodeSidebar from "./NodeSidebar";
import NewNodeModal from "./NewNodeModal";
import type { NodeFilter, NodeListItem, NodeSort } from "./types";
import { matchesFilter, yearOf } from "./nodeListUtils";

const DENSITY_STORAGE_KEY = "bc:nodes:density";

interface NodeListPageProps {
  nodes: NodeListItem[];
  createUrl: string;
  detailUrl: string;
}

interface YearGroup {
  year: number | "pinned" | null;
  items: NodeListItem[];
}

export default function NodeListPage({
  nodes: initialNodes,
  createUrl,
  detailUrl,
}: NodeListPageProps) {
  const [nodes] = useState<NodeListItem[]>(initialNodes);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<NodeSort>("modified");
  const [filter, setFilter] = useState<NodeFilter>({ type: "all" });
  const [dense, setDense] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DENSITY_STORAGE_KEY) === "compact";
  });
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DENSITY_STORAGE_KEY, dense ? "compact" : "grid");
  }, [dense]);

  // "/" focuses search, "N" opens the new-node modal. Ignored while typing.
  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    };
    const handler = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      if (e.key === "/") {
        const input = document.querySelector<HTMLInputElement>(".node-app .nl-search input");
        if (input) {
          e.preventDefault();
          input.focus();
        }
      } else if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setNewOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    const base = nodes.filter(
      n => matchesFilter(n, filter) && n.name.toLowerCase().includes(needle)
    );
    const sorted = [...base].sort((a, b) => {
      const aPinned = !!a.pinned;
      const bPinned = !!b.pinned;
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      if (sort === "modified") {
        return new Date(b.modified).getTime() - new Date(a.modified).getTime();
      }
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "coll") return b.collection_count - a.collection_count;
      if (sort === "todos") return b.todo_count - a.todo_count;
      return 0;
    });
    return sorted;
  }, [nodes, q, sort, filter]);

  const grouped = useMemo<YearGroup[]>(() => {
    // Year-grouping only makes sense for the unfiltered, modified-sort, no-search view.
    if (sort !== "modified" || q || filter.type !== "all") {
      return [{ year: null, items: filtered }];
    }
    const out: YearGroup[] = [];
    let current: YearGroup | null = null;
    for (const n of filtered) {
      if (n.pinned) {
        if (!current || current.year !== "pinned") {
          current = { year: "pinned", items: [] };
          out.push(current);
        }
        current.items.push(n);
        continue;
      }
      const y = yearOf(n.modified);
      if (!current || current.year !== y) {
        current = { year: y, items: [] };
        out.push(current);
      }
      current.items.push(n);
    }
    return out;
  }, [filtered, sort, q, filter]);

  const totalColl = nodes.reduce((s, n) => s + n.collection_count, 0);
  const totalTodo = nodes.reduce((s, n) => s + n.todo_count, 0);

  const detailUrlFor = (uuid: string): string => {
    // detailUrl is reversed with a zero-uuid sentinel — swap in the real one.
    return detailUrl.replace("00000000-0000-0000-0000-000000000000", uuid);
  };

  return (
    <>
      <div className="nl-shell">
        <NodeSidebar
          nodes={nodes}
          totalColl={totalColl}
          totalTodo={totalTodo}
          filter={filter}
          onFilterChange={setFilter}
        />

        <main className="nl-main">
          <div className="nl-head">
            <div>
              <h1>Nodes</h1>
              <p>
                every topic is a node. attach collections, notes, todos, images, and nested nodes.
                they surface in the homepage and drill queue when you revisit them.
              </p>
            </div>
            <div className="nl-head-meta">
              <div className="nl-head-stat">
                <span className="v">{nodes.length}</span>
                <span className="k">nodes</span>
              </div>
              <div className="nl-head-stat">
                <span className="v">{totalColl}</span>
                <span className="k">collections</span>
              </div>
              <div className="nl-head-stat">
                <span className="v">{totalTodo}</span>
                <span className="k">todos</span>
              </div>
              <button
                type="button"
                className="nl-btn primary nl-new-btn"
                onClick={() => setNewOpen(true)}
              >
                <FontAwesomeIcon icon={faPlus} className="nl-btn-icon" />
                new
              </button>
            </div>
          </div>

          <NodeToolbar
            q={q}
            setQ={setQ}
            sort={sort}
            setSort={setSort}
            dense={dense}
            setDense={setDense}
            total={nodes.length}
            showing={filtered.length}
          />

          {filtered.length === 0 ? (
            <div className="nl-empty">
              <div className="nl-empty-glyph">∅</div>
              {q ? (
                <>
                  <h3>
                    no nodes match <code>{q}</code>
                  </h3>
                  <p>try a shorter query, or clear the filter to see all nodes.</p>
                  <button type="button" className="nl-btn ghost" onClick={() => setQ("")}>
                    clear search
                  </button>
                </>
              ) : (
                <>
                  <h3>no nodes in this view</h3>
                  <p>switch to another view or clear the filter.</p>
                  <button
                    type="button"
                    className="nl-btn ghost"
                    onClick={() => setFilter({ type: "all" })}
                  >
                    show all nodes
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className={`nl-groups${dense ? " dense" : ""}`}>
              {grouped.map((g, gi) => (
                <section key={gi} className="nl-group">
                  {g.year !== null && (
                    <div className="nl-year">
                      <div className="nl-year-line" />
                      <div className="nl-year-label">
                        <span className="y">{g.year === "pinned" ? "pinned" : g.year}</span>
                        <span className="c">
                          {g.items.length} node{g.items.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="nl-year-line" />
                    </div>
                  )}
                  <div className={`nl-grid${dense ? " dense" : ""}`}>
                    {g.items.map(n => (
                      <NodeCard
                        key={n.uuid}
                        node={n}
                        dense={dense}
                        detailUrl={detailUrlFor(n.uuid)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          <footer className="nl-footer">
            <span className="meta">
              // bordercore / nodes · press <kbd>N</kbd> to create, <kbd>/</kbd> to search
            </span>
          </footer>
        </main>
      </div>

      <NewNodeModal open={newOpen} onClose={() => setNewOpen(false)} createUrl={createUrl} />
    </>
  );
}
