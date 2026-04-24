import React from "react";
import type { RecentResponse } from "../types";

const dotClass = (r: RecentResponse["response"]): string => {
  switch (r) {
    case "easy":
      return "ok";
    case "good":
      return "info";
    case "hard":
      return "warn";
    case "reset":
      return "danger";
    default: {
      const _exhaustive: never = r;
      return _exhaustive;
    }
  }
};

interface Props {
  items: RecentResponse[];
}

export default function RecentResponses({ items }: Props) {
  return (
    <div>
      <h3>recent responses</h3>
      <ul className="drill-recent">
        {items.map((r, i) => (
          <li key={i}>
            <span className={`dot ${dotClass(r.response)}`} />
            <span className="txt">{r.question}</span>
            <span className="t">{r.ago}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
