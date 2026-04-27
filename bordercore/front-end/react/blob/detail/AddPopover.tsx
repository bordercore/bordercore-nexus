import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useDismiss,
  useInteractions,
  useRole,
  FloatingPortal,
  FloatingFocusManager,
} from "@floating-ui/react";
import axios from "axios";

import type { SearchResult } from "../types";

interface AddPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement>;
  searchUrl: (query: string) => string;
  // Map a raw API response into a list of search-result rows.
  parseResponse: (data: any) => SearchResult[];
  placeholder?: string;
  emptyHint?: string;
  // Render a small icon/swatch on the left of each row.
  rowGlyph?: (item: SearchResult) => React.ReactNode;
  rowSubtext?: (item: SearchResult) => string | undefined;
  onSelect: (item: SearchResult) => void;
  // Optional create-new affordance (e.g. for Collections).
  onCreate?: (name: string) => void;
  createLabel?: string;
}

// Generic search-and-pick popover, used by the rail's "+" buttons.
export function AddPopover({
  open,
  onOpenChange,
  anchorRef,
  searchUrl,
  parseResponse,
  placeholder = "search…",
  emptyHint = "no matches",
  rowGlyph,
  rowSubtext,
  onSelect,
  onCreate,
  createLabel = "Create new",
}: AddPopoverProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const cancelRef = useRef<AbortController | null>(null);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange,
    placement: "bottom-end",
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context);
  const role = useRole(context);
  const { getFloatingProps } = useInteractions([dismiss, role]);

  // Wire the trigger button as floating-ui's reference BEFORE paint, so the
  // popover is positioned correctly on its first render. Without this, the
  // initial render places it at <body> end with no transform, and the focus
  // call below scrolls the page to it.
  useLayoutEffect(() => {
    refs.setReference(anchorRef.current);
  }, [open, anchorRef, refs]);

  // Reset state when the popover closes.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      cancelRef.current?.abort();
    } else {
      // Focus on open. preventScroll so a momentarily-misplaced popover
      // can't pull the page towards it.
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(() => {
      const term = query.trim();
      if (!term) {
        setResults([]);
        return;
      }
      cancelRef.current?.abort();
      const controller = new AbortController();
      cancelRef.current = controller;
      setLoading(true);
      axios
        .get(searchUrl(term), { signal: controller.signal })
        .then(response => {
          setResults(parseResponse(response.data));
        })
        .catch(error => {
          if (axios.isCancel(error) || error.name === "CanceledError") return;
          console.error("AddPopover search error:", error);
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 200);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, open, searchUrl, parseResponse]);

  const handleSelect = useCallback(
    (item: SearchResult) => {
      onSelect(item);
      onOpenChange(false);
    },
    [onSelect, onOpenChange]
  );

  const handleCreate = useCallback(() => {
    const name = query.trim();
    if (!name || !onCreate) return;
    onCreate(name);
    onOpenChange(false);
  }, [query, onCreate, onOpenChange]);

  if (!open) return null;

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
        <div
          ref={refs.setFloating}
          // must remain inline
          style={floatingStyles}
          className="bd-add-related-pop"
          {...getFloatingProps()}
        >
          <div className="pop-search">
            <FontAwesomeIcon icon={faSearch} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder={placeholder}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && results[0]) {
                  e.preventDefault();
                  handleSelect(results[0]);
                } else if (e.key === "Escape") {
                  onOpenChange(false);
                }
              }}
            />
          </div>

          <div className="pop-results">
            {loading && <div className="pop-empty">searching…</div>}
            {!loading && results.length === 0 && query.trim() === "" && (
              <div className="pop-empty">type to search</div>
            )}
            {!loading && results.length === 0 && query.trim() !== "" && (
              <div className="pop-empty">{emptyHint}</div>
            )}
            {!loading &&
              results.map(item => (
                <div key={item.uuid} className="pop-result" onClick={() => handleSelect(item)}>
                  {rowGlyph ? rowGlyph(item) : null}
                  <span className="name">{item.name || item.question || item.uuid}</span>
                  {rowSubtext ? <span className="type-pill">{rowSubtext(item)}</span> : null}
                </div>
              ))}
          </div>

          {onCreate && query.trim() !== "" && (
            <div className="pop-foot">
              <button type="button" className="bd-show-more" onClick={handleCreate}>
                {createLabel} <kbd>{query.trim()}</kbd>
              </button>
              <span>
                <kbd>Esc</kbd> to close
              </span>
            </div>
          )}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
}

export default AddPopover;
