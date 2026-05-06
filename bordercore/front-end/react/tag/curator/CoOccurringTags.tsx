import React from "react";
import type { RelatedTag } from "./types";

interface Props {
  activeName: string;
  related: RelatedTag[];
  knownTagNames: string[];
  onPick: (tagName: string) => void;
}

export function CoOccurringTags({ activeName, related, knownTagNames, onPick }: Props) {
  const known = new Set(knownTagNames);
  return (
    <div className="tg-card tg-cooccur">
      <div className="tg-card__head">
        <h2 className="tg-card__title">co-occurring tags</h2>
        <span className="tg-card__meta">tags appearing alongside {activeName}</span>
      </div>
      {related.length === 0 ? (
        <div className="tg-cooccur__empty">no co-occurring tags yet.</div>
      ) : (
        <div className="tg-cooccur__list">
          {related.map(t => {
            const inLibrary = known.has(t.tag_name);
            return (
              <button
                key={t.tag_name}
                type="button"
                className={`tg-chip ${inLibrary ? "" : "tg-chip--disabled"}`}
                disabled={!inLibrary}
                onClick={() => inLibrary && onPick(t.tag_name)}
                title={inLibrary ? `view ${t.tag_name}` : "not in your library"}
              >
                {t.tag_name}
                <span className="tg-chip__count">{t.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
