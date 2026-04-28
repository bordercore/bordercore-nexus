import React, { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faXmark,
  faPlus,
  faLink,
  faUser,
  faAlignLeft,
  faPalette,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

import { doGet } from "../../utils/reactUtils";

export interface MetadataItem {
  name: string;
  value: string;
}

interface MetadataCardProps {
  metadata: MetadataItem[];
  onChange: (metadata: MetadataItem[]) => void;
  nameSearchUrl: string;
}

interface KnownKey {
  name: string;
  icon: IconDefinition;
}

const KNOWN_KEYS: KnownKey[] = [
  { name: "Url", icon: faLink },
  { name: "Author", icon: faUser },
  { name: "Subtitle", icon: faAlignLeft },
  { name: "Artist", icon: faPalette },
];

function iconFor(name: string): IconDefinition | null {
  return KNOWN_KEYS.find(k => k.name.toLowerCase() === name.toLowerCase())?.icon ?? null;
}

export function MetadataCard({ metadata, onChange, nameSearchUrl }: MetadataCardProps) {
  const valueRefs = useRef<(HTMLInputElement | null)[]>([]);
  const nameRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [autoFocus, setAutoFocus] = useState<{ index: number; field: "name" | "value" } | null>(
    null
  );

  const [acIndex, setAcIndex] = useState<number | null>(null);
  const [acSuggestions, setAcSuggestions] = useState<string[]>([]);
  const [acHighlight, setAcHighlight] = useState(0);
  const acReqId = useRef(0);

  useEffect(() => {
    if (!autoFocus) return;
    const refs = autoFocus.field === "name" ? nameRefs : valueRefs;
    refs.current[autoFocus.index]?.focus();
    setAutoFocus(null);
  }, [autoFocus, metadata]);

  const fetchSuggestions = useCallback(
    (query: string) => {
      if (!nameSearchUrl) return;
      const trimmed = query.trim();
      if (!trimmed) {
        setAcSuggestions([]);
        return;
      }
      const reqId = ++acReqId.current;
      doGet(`${nameSearchUrl}${encodeURIComponent(trimmed)}`, response => {
        if (reqId !== acReqId.current) return; // out-of-order response
        const known = new Set(KNOWN_KEYS.map(k => k.name.toLowerCase()));
        const next: string[] = (response.data || [])
          .map((row: { label: string }) => row.label)
          .filter((label: string) => !known.has(label.toLowerCase()));
        setAcSuggestions(next);
        setAcHighlight(0);
      });
    },
    [nameSearchUrl]
  );

  const updateRow = (index: number, patch: Partial<MetadataItem>) => {
    onChange(metadata.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const removeRow = (index: number) => {
    onChange(metadata.filter((_, i) => i !== index));
  };

  const addRow = (key: string) => {
    setAutoFocus({ index: metadata.length, field: key === "" ? "name" : "value" });
    onChange([...metadata, { name: key, value: "" }]);
  };

  const closeAutocomplete = () => {
    setAcIndex(null);
    setAcSuggestions([]);
  };

  const acceptSuggestion = (index: number, label: string) => {
    updateRow(index, { name: label });
    closeAutocomplete();
    setAutoFocus({ index, field: "value" });
  };

  return (
    <div className="be-section">
      <div className="be-label">
        <span className="be-section-title">Metadata</span>
        <span className="meta">
          {metadata.length} {metadata.length === 1 ? "field" : "fields"}
        </span>
      </div>
      <div className="be-meta-rows">
        {metadata.map((row, index) => {
          const known = iconFor(row.name);
          return (
            <div key={index} className="be-meta-row">
              <div className="be-meta-key-wrap">
                <input
                  ref={el => {
                    nameRefs.current[index] = el;
                  }}
                  className={`key ${known ? "known" : ""}`}
                  type="text"
                  value={row.name}
                  onChange={e => {
                    const next = e.target.value;
                    updateRow(index, { name: next });
                    setAcIndex(index);
                    fetchSuggestions(next);
                  }}
                  onFocus={() => {
                    if (row.name.trim().length > 0) {
                      setAcIndex(index);
                      fetchSuggestions(row.name);
                    }
                  }}
                  onBlur={() => {
                    // Delay so a click on a suggestion can fire first
                    window.setTimeout(() => {
                      setAcIndex(prev => (prev === index ? null : prev));
                    }, 120);
                  }}
                  onKeyDown={e => {
                    if (acIndex !== index || acSuggestions.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setAcHighlight(h => (h + 1) % acSuggestions.length);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setAcHighlight(h => (h - 1 + acSuggestions.length) % acSuggestions.length);
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      acceptSuggestion(index, acSuggestions[acHighlight]);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      closeAutocomplete();
                    }
                  }}
                  autoComplete="off"
                  placeholder="key"
                />
                {acIndex === index && acSuggestions.length > 0 && (
                  <ul className="be-meta-key-autocomplete" role="listbox">
                    {acSuggestions.map((label, i) => (
                      <li
                        key={label}
                        role="option"
                        aria-selected={i === acHighlight}
                        className={i === acHighlight ? "active" : ""}
                        onMouseDown={e => {
                          e.preventDefault();
                          acceptSuggestion(index, label);
                        }}
                        onMouseEnter={() => setAcHighlight(i)}
                      >
                        {label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <input
                ref={el => {
                  valueRefs.current[index] = el;
                }}
                className="value"
                type="text"
                value={row.value}
                onChange={e => updateRow(index, { value: e.target.value })}
                autoComplete="off"
                placeholder="value"
              />
              <button
                type="button"
                className="remove"
                onClick={() => removeRow(index)}
                aria-label="Remove metadata"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="be-meta-add-row">
        <span className="plus">
          <FontAwesomeIcon icon={faPlus} />
        </span>
        {KNOWN_KEYS.map(k => (
          <button
            key={k.name}
            type="button"
            className="be-meta-chip"
            onClick={() => addRow(k.name)}
          >
            <FontAwesomeIcon icon={k.icon} /> {k.name}
          </button>
        ))}
        <button type="button" className="be-meta-chip custom" onClick={() => addRow("")}>
          custom…
        </button>
      </div>
    </div>
  );
}

export default MetadataCard;
