import React, { useMemo, useState } from "react";
import type { TagProgressRow } from "../types";

type Mode = "all" | "critical" | "recent";

interface Props {
  tags: TagProgressRow[];
}

export default function TagsNeedingReview({ tags }: Props) {
  const [mode, setMode] = useState<Mode>("all");
  const filtered = useMemo(() => {
    if (mode === "critical") return tags.filter(t => (t.overdueDays ?? 0) > 295);
    if (mode === "recent") return tags.filter(t => (t.overdueDays ?? 0) <= 295);
    return tags;
  }, [mode, tags]);

  return (
    <section className="drill-card">
      <div className="head">
        <div className="title">
          <h2>Tags needing review</h2>
          <span className="count-chip hot">{tags.length} overdue</span>
        </div>
        <div className="drill-tags-filter">
          {(["all", "critical", "recent"] as Mode[]).map(m => (
            <button
              key={m}
              type="button"
              className={mode === m ? "active" : ""}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="drill-card-thead">
        <span>tag</span>
        <span>overdue</span>
        <span>last reviewed · questions</span>
      </div>
      <div className="drill-tag-scroll">
        {filtered.map(t => (
          <a key={t.name} className="drill-tag-row" href={t.url}>
            <span className="name">
              <span className={`pip ${t.pip}`} />
              <span className="text">{t.name}</span>
            </span>
            <span className={`overdue-days ${(t.overdueDays ?? 0) <= 295 ? "warn" : ""}`}>
              +{t.overdueDays ?? 0}d
            </span>
            <span className="meta-right">
              <span className="last">{t.last_reviewed}</span>
              <span className="count">{t.count}q</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
