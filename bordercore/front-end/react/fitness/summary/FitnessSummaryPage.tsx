import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import type { SummaryPayload, FilterGroup } from "./types";
import { ExerciseCard } from "./ExerciseCard";

const ALL_GROUP: FilterGroup = { slug: "all", label: "all", color_token: "" };

interface FitnessSummaryPageProps {
  payload: SummaryPayload;
}

function readInitialFilter(): string {
  if (typeof window === "undefined") return "all";
  return new URLSearchParams(window.location.search).get("group") || "all";
}

function syncFilterToUrl(slug: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (slug === "all") {
    url.searchParams.delete("group");
  } else {
    url.searchParams.set("group", slug);
  }
  window.history.replaceState({}, "", url.toString());
}

/**
 * Card-grid fitness landing page. Renders a top bar, filter chip row, and a
 * uniform grid of ExerciseCards sorted today → overdue → on-track. Inactive
 * exercises live behind a toggle at the bottom.
 *
 * State held locally: the active filter slug + the inactive-shown flag. The
 * filter persists to ``?group=<slug>`` so links are shareable.
 */
export function FitnessSummaryPage({ payload }: FitnessSummaryPageProps) {
  const { groups, exercises } = payload;

  const [filter, setFilter] = useState<string>(() => {
    const initial = readInitialFilter();
    const known = initial === "all" || groups.some(g => g.slug === initial);
    return known ? initial : "all";
  });
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    syncFilterToUrl(filter);
  }, [filter]);

  const handleFilter = useCallback((slug: string) => {
    setFilter(slug);
  }, []);

  const { active, inactive, inactiveCount } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matchesGroup = (group: string) => filter === "all" || group === filter;
    const matchesName = (name: string) => !needle || name.toLowerCase().includes(needle);
    const matches = (e: (typeof exercises)[number]) => matchesGroup(e.group) && matchesName(e.name);
    const a = exercises.filter(e => e.is_active && matches(e));
    const inAll = exercises.filter(e => !e.is_active);
    const inFiltered = inAll.filter(matches);
    return { active: a, inactive: inFiltered, inactiveCount: inAll.length };
  }, [exercises, filter, query]);

  const chipGroups = useMemo<FilterGroup[]>(() => [ALL_GROUP, ...groups], [groups]);

  return (
    <section className="fitness-summary">
      <header className="fitness-summary__topbar">
        <h1 className="fitness-summary__title">
          <span className="bc-page-title">Fitness</span>
        </h1>
        <div className="fitness-summary__search" role="search">
          <FontAwesomeIcon icon={faSearch} aria-hidden="true" />
          <input
            type="search"
            placeholder="search exercises"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="search exercises"
          />
          {query && (
            <button
              type="button"
              className="fitness-summary__search-clear"
              onClick={() => setQuery("")}
              aria-label="clear search"
            >
              ×
            </button>
          )}
        </div>
      </header>

      <nav className="fitness-summary__chips" aria-label="muscle group filter">
        {chipGroups.map(g => (
          <button
            key={g.slug}
            type="button"
            className={`fitness-chip${g.slug === filter ? " fitness-chip--active" : ""}`}
            data-group={g.slug}
            aria-pressed={g.slug === filter}
            onClick={() => handleFilter(g.slug)}
          >
            {g.slug !== "all" && <span className="fitness-chip__dot" aria-hidden="true" />}
            {g.label.toLowerCase()}
          </button>
        ))}
      </nav>

      {active.length === 0 ? (
        <p className="fitness-summary__empty">no exercises match this filter.</p>
      ) : (
        <ul className="fitness-summary__grid">
          {active.map(card => (
            <li key={card.uuid} className="fitness-summary__cell">
              <ExerciseCard card={card} />
            </li>
          ))}
        </ul>
      )}

      {inactiveCount > 0 && (
        <div className="fitness-summary__inactive">
          <button
            type="button"
            className="fitness-summary__inactive-toggle"
            onClick={() => setShowInactive(s => !s)}
            aria-expanded={showInactive}
          >
            {showInactive ? "▾" : "▸"} {showInactive ? "hide" : "show"} inactive ({inactiveCount})
          </button>
          {showInactive && inactive.length > 0 && (
            <ul className="fitness-summary__grid fitness-summary__grid--inactive">
              {inactive.map(card => (
                <li key={card.uuid} className="fitness-summary__cell">
                  <ExerciseCard card={card} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export default FitnessSummaryPage;
