import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faFilter, faTrash } from "@fortawesome/free-solid-svg-icons";
import type { AliasLibraryRow } from "./types";

interface Props {
  activeName: string;
  tagNames: string[];
  aliasLibrary: AliasLibraryRow[];
  onAdd: (tagName: string, aliasName: string) => Promise<void>;
  onRemove: (tagName: string, uuid: string) => void;
  onPickTag: (tagName: string) => void;
}

export function AliasForge({
  activeName,
  tagNames,
  aliasLibrary,
  onAdd,
  onRemove,
  onPickTag,
}: Props) {
  const [forgeAlias, setForgeAlias] = useState("");
  const [forgeTag, setForgeTag] = useState(activeName);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setForgeTag(activeName);
  }, [activeName]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return aliasLibrary;
    return aliasLibrary.filter(
      a => a.name.toLowerCase().includes(q) || a.tag.toLowerCase().includes(q)
    );
  }, [aliasLibrary, filter]);

  const submit = async () => {
    const v = forgeAlias.trim().toLowerCase();
    if (!v) return;
    await onAdd(forgeTag, v);
    setForgeAlias("");
  };

  return (
    <div className="tg-forge">
      <div className="tg-card__head tg-forge__head">
        <h2 className="tg-forge__title">alias forge</h2>
        <span className="tg-card__meta">
          {aliasLibrary.length} aliases · {tagNames.length} tags
        </span>
      </div>
      <p className="tg-forge__desc">
        every alias in your library. searches for any alias resolve to its canonical tag.
      </p>

      <div className="tg-input-line">
        <span className="tg-input-line__prompt">›</span>
        <input
          value={forgeAlias}
          onChange={e => setForgeAlias(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="new alias…"
          className="tg-input-line__field"
        />
        <span className="tg-input-line__arrow">→</span>
        <select
          value={forgeTag}
          onChange={e => setForgeTag(e.target.value)}
          className="tg-forge-select"
        >
          {tagNames.map(n => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button type="button" className="tg-action" onClick={submit} disabled={!forgeAlias.trim()}>
          <FontAwesomeIcon icon={faPlus} /> forge
        </button>
      </div>

      <div className="tg-forge__filter">
        <FontAwesomeIcon icon={faFilter} className="tg-forge__filter-icon" />
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="filter aliases or tags…"
          className="tg-forge__filter-field"
        />
        <span className="tg-forge__filter-count">
          {filtered.length} / {aliasLibrary.length}
        </span>
      </div>

      <div className="tg-alias-table">
        <div className="tg-alias-thead">
          <span className="tg-alias-col tg-alias-col--idx">#</span>
          <span className="tg-alias-col tg-alias-col--alias">alias</span>
          <span className="tg-alias-col tg-alias-col--arrow">→</span>
          <span className="tg-alias-col tg-alias-col--resolved">resolves to</span>
          <span className="tg-alias-col tg-alias-col--action" />
        </div>
        <div className="tg-alias-body">
          {filtered.length === 0 && <div className="tg-alias-empty">no aliases match.</div>}
          {filtered.map((a, i) => (
            <div
              key={a.uuid}
              className={`tg-alias-row ${a.tag === activeName ? "tg-alias-row--current" : ""}`}
            >
              <span className="tg-alias-col tg-alias-col--idx">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="tg-alias-col tg-alias-col--alias tg-alias-name">{a.name}</span>
              <span className="tg-alias-col tg-alias-col--arrow">→</span>
              <span className="tg-alias-col tg-alias-col--resolved">
                <button
                  type="button"
                  className="tg-alias-tag-link"
                  onClick={() => onPickTag(a.tag)}
                  title={`view ${a.tag}`}
                >
                  {a.tag}
                </button>
              </span>
              <span className="tg-alias-col tg-alias-col--action">
                <button
                  type="button"
                  className="tg-alias-revoke"
                  onClick={() => onRemove(a.tag, a.uuid)}
                  title="revoke alias"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
