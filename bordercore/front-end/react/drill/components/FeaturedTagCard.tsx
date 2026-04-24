import React, { useCallback, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import SelectValue, { SelectValueHandle } from "../../common/SelectValue";
import { doGet } from "../../utils/reactUtils";
import { pluralize } from "../utils";
import type { FeaturedTag } from "../types";

interface Props {
  initial: FeaturedTag;
  tagSearchUrl: string;
  featuredTagInfoUrl: string;
}

// Hoisted: must remain inline (overrides shared .drill-card .head chrome).
const HEAD_STYLE = { border: "none", padding: 0, margin: 0 } as const;

export default function FeaturedTagCard({ initial, tagSearchUrl, featuredTagInfoUrl }: Props) {
  const [featured, setFeatured] = useState<FeaturedTag>(initial);
  const [editing, setEditing] = useState(false);
  const selectRef = useRef<SelectValueHandle>(null);

  const max = Math.max(1, ...featured.histo);

  const startEditing = useCallback(() => {
    setEditing(true);
    // Focus the input on the next tick so it's mounted by then.
    setTimeout(() => selectRef.current?.focus(), 0);
  }, []);

  const handleSelect = useCallback(
    (selection: { name?: string; label?: string }) => {
      const name = selection.name || selection.label;
      if (!name) return;
      doGet(
        `${featuredTagInfoUrl}?tag=${encodeURIComponent(name)}`,
        (response: { data: FeaturedTag }) => {
          setFeatured(response.data);
          setEditing(false);
        },
        "Error fetching featured tag info"
      );
    },
    [featuredTagInfoUrl]
  );

  return (
    <section className="drill-card drill-featured">
      {/* must remain inline: overrides shared .drill-card .head chrome */}
      <div className="head" style={HEAD_STYLE}>
        {editing ? (
          <div className="featured-search">
            <SelectValue
              ref={selectRef}
              searchUrl={`${tagSearchUrl}?doctype=drill&query=`}
              placeHolder="Search tag"
              onSelect={handleSelect}
            />
          </div>
        ) : (
          <div className="title">
            Featured Tag:{" "}
            <a className="name" href={featured.url}>
              {featured.name}
            </a>
          </div>
        )}
        {!editing && (
          <button
            type="button"
            className="search-btn"
            onClick={startEditing}
            aria-label="Search tag"
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </button>
        )}
      </div>
      <div className="stats">
        <span className="bigpct">
          {featured.progress}
          <span className="sign">%</span>
        </span>
        <div className="last-row">
          <span className="k">last reviewed</span>
          <span className="v">{featured.last_reviewed}</span>
        </div>
        <span className="questions">
          {featured.count} {pluralize("question", featured.count)}
        </span>
      </div>
      <div className="histo">
        {featured.histo.map((v, i) => (
          <div
            key={i}
            className={`bar ${v < max * 0.3 ? "dim" : ""}`}
            // must remain inline: bar height is data-driven and cannot be expressed as a static class
            style={{ height: `${(v / max) * 100}%` }}
          />
        ))}
      </div>
    </section>
  );
}
