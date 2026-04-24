import React from "react";
import type { ResponseKind } from "../types";

const SWATCHES: Record<ResponseKind, string> = {
  easy: "var(--ok)",
  good: "var(--bc-accent-2)",
  hard: "var(--warn)",
  reset: "var(--danger)",
};

interface Props {
  counts: Record<ResponseKind, number>;
}

export default function ByResponseNav({ counts }: Props) {
  return (
    <div>
      <h3>by response</h3>
      <div className="drill-nav">
        {(Object.keys(SWATCHES) as ResponseKind[]).map(k => (
          <div key={k} className="drill-response-item">
            {/* must remain inline: swatch color is data-driven from SWATCHES map */}
            <span className="swatch" style={{ background: SWATCHES[k] }} />
            <span className="label">{k}</span>
            <span className="count">{counts[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
