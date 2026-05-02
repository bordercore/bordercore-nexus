import React from "react";
import { importanceToDots } from "./types";

interface ImportanceDotsProps {
  importance: number;
}

export function ImportanceDots({ importance }: ImportanceDotsProps) {
  const lit = importanceToDots(importance);
  if (lit === 0) return null;
  return (
    <span className="nl-imp" role="img" aria-label={`Importance ${lit} of 5`}>
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className={`nl-imp-dot ${i < lit ? "is-lit" : ""}`} />
      ))}
    </span>
  );
}

export default ImportanceDots;
