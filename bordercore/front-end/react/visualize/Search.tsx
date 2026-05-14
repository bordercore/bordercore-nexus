import React, { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faXmark } from "@fortawesome/free-solid-svg-icons";
import type { GraphNode } from "./types";

interface SearchProps {
  nodes: GraphNode[];
  // Called when the user picks a result (click, Enter, or arrow-down + Enter).
  // The page should set its focus target so ForceGraph flies the camera to it.
  onPick: (uuid: string) => void;
}

const MAX_RESULTS = 6;
// Constellations can have ~1500 rendered items; building the lowercased
// haystack on every keystroke would be wasteful. We cache it per-nodes.
function buildIndex(nodes: GraphNode[]): Array<{ node: GraphNode; haystack: string }> {
  return nodes.map(node => ({ node, haystack: node.name.toLowerCase() }));
}

/**
 * Top-left search pill for the constellation page. Substring-matches against
 * node names, shows a dropdown of up to MAX_RESULTS hits, and on pick hands
 * the uuid up so the camera can fly to it via the existing focus mechanism.
 */
export function Search({ nodes, onPick }: SearchProps) {
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const index = useMemo(() => buildIndex(nodes), [nodes]);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    const hits: GraphNode[] = [];
    for (const entry of index) {
      if (entry.haystack.includes(trimmed)) {
        hits.push(entry.node);
        if (hits.length >= MAX_RESULTS) break;
      }
    }
    return hits;
  }, [index, query]);

  // Reset the highlight whenever the result list shifts under it.
  useEffect(() => {
    setHighlightIdx(0);
  }, [results]);

  // Click outside closes the dropdown without clearing the query, so the user
  // can re-open it by focusing the input again.
  useEffect(() => {
    function handleDocClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  // Cmd/Ctrl+K focuses the search — standard "go-to-anything" shortcut.
  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  function pick(node: GraphNode) {
    onPick(node.uuid);
    setQuery(node.name);
    setIsOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIdx(idx => Math.min(results.length - 1, idx + 1));
      setIsOpen(true);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIdx(idx => Math.max(0, idx - 1));
    } else if (event.key === "Enter") {
      const choice = results[highlightIdx];
      if (choice) {
        event.preventDefault();
        pick(choice);
      }
    } else if (event.key === "Escape") {
      if (query) {
        setQuery("");
      } else {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
  }

  const showResults = isOpen && results.length > 0;

  return (
    <div ref={containerRef} className="constellation-search">
      <div className="constellation-search-input-wrap">
        <FontAwesomeIcon icon={faSearch} className="constellation-search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="constellation-search-input"
          placeholder="Search constellation…"
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          aria-label="Search constellation"
          aria-autocomplete="list"
          aria-expanded={showResults}
        />
        {query && (
          <button
            type="button"
            className="constellation-search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        )}
      </div>
      {showResults && (
        <ul className="constellation-search-results" role="listbox">
          {results.map((node, idx) => (
            <li
              key={node.uuid}
              role="option"
              aria-selected={idx === highlightIdx}
              className={
                idx === highlightIdx
                  ? "constellation-search-result constellation-search-result-active"
                  : "constellation-search-result"
              }
              onMouseDown={event => {
                // mousedown so the input doesn't lose focus before we pick.
                event.preventDefault();
                pick(node);
              }}
              onMouseEnter={() => setHighlightIdx(idx)}
            >
              <span className="constellation-search-result-name">{node.name || "Untitled"}</span>
              <span className="constellation-search-result-type">{node.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Search;
