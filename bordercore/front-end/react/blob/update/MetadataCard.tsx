import React, { useEffect, useRef, useState } from "react";
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

export interface MetadataItem {
  name: string;
  value: string;
}

interface MetadataCardProps {
  metadata: MetadataItem[];
  onChange: (metadata: MetadataItem[]) => void;
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

export function MetadataCard({ metadata, onChange }: MetadataCardProps) {
  const valueRefs = useRef<(HTMLInputElement | null)[]>([]);
  const nameRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [autoFocus, setAutoFocus] = useState<{ index: number; field: "name" | "value" } | null>(
    null
  );

  useEffect(() => {
    if (!autoFocus) return;
    const refs = autoFocus.field === "name" ? nameRefs : valueRefs;
    refs.current[autoFocus.index]?.focus();
    setAutoFocus(null);
  }, [autoFocus, metadata]);

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
                  onChange={e => updateRow(index, { name: e.target.value })}
                  autoComplete="off"
                  placeholder="key"
                />
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
