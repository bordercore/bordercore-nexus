import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";
import { doGet } from "../../utils/reactUtils";

interface SearchMatch {
  doctype: "Tag";
  label: string;
  value?: string;
  link?: string;
}

type Row =
  | { kind: "tag"; name: string; isCurrent: boolean }
  | { kind: "alias"; alias: string; canonical: string };

interface TagSearchProps {
  activeName: string;
  searchUrl: string;
  onPick: (tagName: string) => void;
}

export function TagSearch({ activeName, searchUrl, onPick }: TagSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!query.trim()) {
      setRows([]);
      return;
    }
    const t = setTimeout(() => {
      doGet(
        `${searchUrl}${encodeURIComponent(query)}`,
        response => {
          const matches = (response.data || []) as SearchMatch[];
          const out: Row[] = matches.slice(0, 12).map(m => {
            // services.get_tag_aliases serialises labels as "<alias> -> <canonical>"
            // (ASCII arrow, see bordercore/tag/services.py); detect that exact form.
            const arrow = m.label.indexOf(" -> ");
            if (arrow !== -1 && m.value) {
              return {
                kind: "alias",
                alias: m.label.slice(0, arrow),
                canonical: m.value,
              };
            }
            return { kind: "tag", name: m.label, isCurrent: m.label === activeName };
          });
          setRows(out);
          setHover(0);
        },
        "Tag search failed"
      );
    }, 120);
    return () => clearTimeout(t);
  }, [query, open, activeName, searchUrl]);

  const pickAt = (i: number) => {
    const row = rows[i];
    if (!row) return;
    const name = row.kind === "tag" ? row.name : row.canonical;
    onPick(name);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHover(h => Math.min(h + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHover(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pickAt(hover);
    } else if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="tg-search" ref={wrapRef}>
      <FontAwesomeIcon icon={faMagnifyingGlass} className="tg-search__icon" />
      <input
        ref={inputRef}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder="search tags or aliases…"
        className="tg-search__input"
      />
      {query && (
        <button
          type="button"
          className="tg-search__clear"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          aria-label="clear"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      )}
      {!open && <kbd className="tg-search__kbd">⌘K</kbd>}
      {open && (
        <div className="tg-search-pop">
          {rows.length === 0 ? (
            <div className="tg-search-pop__empty">no matches.</div>
          ) : (
            rows.map((r, i) => (
              <button
                key={i}
                type="button"
                className={`tg-search-row ${i === hover ? "tg-search-row--hover" : ""}`}
                onMouseEnter={() => setHover(i)}
                onClick={() => pickAt(i)}
              >
                {r.kind === "tag" ? (
                  <>
                    <span className="tg-search-row__lbl">🏷 {r.name}</span>
                    {r.isCurrent && <span className="tg-search-row__now">now</span>}
                  </>
                ) : (
                  <>
                    <span className="tg-search-row__lbl tg-search-row__lbl--alias">
                      ↪ {r.alias}
                    </span>
                    <span className="tg-search-row__arrow">→</span>
                    <span className="tg-search-row__resolved">{r.canonical}</span>
                  </>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
