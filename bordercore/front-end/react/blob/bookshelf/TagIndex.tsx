import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { BookshelfCategory } from "../types";

interface TagIndexProps {
  categories: BookshelfCategory[];
  selectedTag: string | null;
  /** Trimmed lowercase live search query; filters chips by tag name. */
  searchQuery: string;
  /** Base URL for tag chip links — clicks reload with `?tag=<name>`. */
  buildTagHref: (tagName: string) => string;
}

// Max chips rendered per category before the "+N more" toggle appears.
// Tuned so each collapsed category fits in roughly 2-3 wrapped lines at
// the rail's typical width.
const CHIP_COLLAPSED_LIMIT = 10;
const EXPANDED_LS_KEY = "bordercore:bookshelf:expandedCategories";

function readInitialExpanded(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(EXPANDED_LS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Left rail of the Card Catalog: each meta-category gets a 2-digit index
 * chip + a wrapping row of tag chips. The selected tag chip retints to
 * the category accent. When a search query is active, chips and whole
 * categories are dropped if no tag name matches — the rail re-numbers
 * remaining categories in place.
 *
 * Categories with more than CHIP_COLLAPSED_LIMIT chips render truncated
 * by default, with a `+N more` toggle that flips the section to its full
 * chip list. Per-category open state persists to localStorage. Active
 * searches bypass the truncation entirely — when the user is narrowing,
 * showing every match is the whole point.
 */
export function TagIndex({ categories, selectedTag, searchQuery, buildTagHref }: TagIndexProps) {
  const selected = (selectedTag || "").toLowerCase();
  const isSearching = searchQuery.length > 0;

  const [expanded, setExpanded] = useState<Set<string>>(readInitialExpanded);

  useEffect(() => {
    try {
      window.localStorage.setItem(EXPANDED_LS_KEY, JSON.stringify(Array.from(expanded)));
    } catch {
      /* localStorage unavailable — silently ignore. */
    }
  }, [expanded]);

  const toggleCategory = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Narrow the rail to chips whose tag name contains the query (case-
  // insensitive substring). Categories that have no matching chips drop
  // out entirely so the rail doesn't leave empty section headers.
  const visible = useMemo(() => {
    if (!isSearching) return categories;
    return categories
      .map(cat => ({
        ...cat,
        tags: cat.tags.filter(t => t.name.toLowerCase().includes(searchQuery)),
      }))
      .filter(cat => cat.tags.length > 0);
  }, [categories, searchQuery, isSearching]);

  return (
    <aside className="bcc-rail">
      <h2 className="bcc-rail__title">Tag Index</h2>

      {visible.length === 0 ? (
        <div className="bcc-rail__empty">No tags match.</div>
      ) : (
        <div className="bcc-rail__categories">
          {visible.map((cat, idx) => {
            const isExpanded = expanded.has(cat.id);
            const overflow = !isSearching && cat.tags.length > CHIP_COLLAPSED_LIMIT;
            const tagsToRender =
              overflow && !isExpanded ? cat.tags.slice(0, CHIP_COLLAPSED_LIMIT) : cat.tags;
            const hiddenCount = cat.tags.length - CHIP_COLLAPSED_LIMIT;

            return (
              <section key={cat.id} className="bcc-category" data-category={cat.id}>
                <header className="bcc-category__head">
                  <span className="bcc-category__idx">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="bcc-category__label">{cat.label}</span>
                  <span className="bcc-category__rule" aria-hidden="true" />
                </header>
                <ul className="bcc-category__chips">
                  {tagsToRender.map(tag => {
                    const isActive = tag.name.toLowerCase() === selected;
                    return (
                      <li key={tag.name}>
                        <a
                          href={buildTagHref(tag.name)}
                          className={`bcc-chip${isActive ? " bcc-chip--active" : ""}`}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <span className="bcc-chip__name">{tag.name}</span>
                          <span className="bcc-chip__count">{tag.count}</span>
                        </a>
                      </li>
                    );
                  })}
                  {overflow ? (
                    <li>
                      <button
                        type="button"
                        className="bcc-chip bcc-chip--toggle"
                        onClick={() => toggleCategory(cat.id)}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? "− less" : `+ ${hiddenCount} more`}
                      </button>
                    </li>
                  ) : null}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}
