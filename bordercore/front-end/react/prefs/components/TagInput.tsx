import axios from "axios";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface TagSuggestion {
  name: string;
  count?: number;
}

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  searchUrl?: string;
  minLength?: number;
  placeholder?: string;
}

function normalize(tag: string): string {
  return tag.trim().toLowerCase();
}

export function TagInput({
  tags,
  onChange,
  searchUrl,
  minLength = 2,
  placeholder = "type a tag and press enter…",
}: TagInputProps) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);

  const filtered = useMemo(
    () => suggestions.filter(s => !tags.includes(normalize(s.name))),
    [suggestions, tags]
  );

  // Fetch remote suggestions as the user types.
  useEffect(() => {
    if (!searchUrl) {
      setSuggestions([]);
      return;
    }
    const q = text.trim();
    if (q.length < minLength) {
      setSuggestions([]);
      return;
    }

    const token = ++requestRef.current;
    const handle = window.setTimeout(async () => {
      try {
        const resp = await axios.get(`${searchUrl}${encodeURIComponent(q)}`);
        if (token !== requestRef.current) return;
        const raw = Array.isArray(resp.data) ? resp.data : [];
        setSuggestions(
          raw.slice(0, 6).map((item: any): TagSuggestion => {
            const name =
              typeof item === "string" ? item : item.label || item.name || String(item.value ?? "");
            const count =
              typeof item === "object" && typeof item.count === "number" ? item.count : undefined;
            return { name, count };
          })
        );
      } catch {
        if (token === requestRef.current) setSuggestions([]);
      }
    }, 150);
    return () => window.clearTimeout(handle);
  }, [text, minLength, searchUrl]);

  const add = useCallback(
    (raw: string) => {
      const value = normalize(raw);
      if (!value || tags.includes(value)) return;
      onChange([...tags, value]);
      setText("");
      setActive(0);
    },
    [tags, onChange]
  );

  const remove = useCallback(
    (tag: string) => {
      onChange(tags.filter(t => t !== tag));
    },
    [tags, onChange]
  );

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (filtered[active]) add(filtered[active].name);
      else if (text.trim()) add(text);
    } else if (e.key === "Backspace" && text === "" && tags.length > 0) {
      remove(tags[tags.length - 1]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(a => Math.min(a + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === "Escape") {
      setText("");
      setSuggestions([]);
    }
  };

  return (
    <div
      className={`prefs-tag-input${focused ? " focus" : ""}`}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map(t => (
        <span key={t} className="chip">
          {t}
          <button
            type="button"
            aria-label={`Remove ${t}`}
            onClick={e => {
              e.stopPropagation();
              remove(t);
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="raw"
        value={text}
        onChange={e => {
          setText(e.target.value);
          setActive(0);
        }}
        onKeyDown={handleKey}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        placeholder={tags.length ? "" : placeholder}
      />
      {focused && filtered.length > 0 && (
        <div className="prefs-suggest">
          {filtered.map((s, i) => (
            <div
              key={s.name}
              className={`s-item${i === active ? " active" : ""}`}
              onMouseDown={e => {
                e.preventDefault();
                add(s.name);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{s.name}</span>
              {typeof s.count === "number" && <span className="count">{s.count}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TagInput;
