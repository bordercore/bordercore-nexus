import React from "react";
import type { TargetedMuscles } from "../types";

interface MusclesCardProps {
  muscles: TargetedMuscles;
}

export function MusclesCard({ muscles }: MusclesCardProps) {
  const entries: { name: string; tag: "primary" | "secondary" }[] = [
    ...muscles.primary.map(name => ({ name, tag: "primary" as const })),
    ...muscles.secondary.map(name => ({ name, tag: "secondary" as const })),
  ];

  return (
    <div className="ex-card">
      <h3>muscles targeted</h3>
      {entries.length === 0 ? (
        <p className="ex-no-description">no muscles tagged</p>
      ) : (
        <div>
          {entries.map(m => (
            <div key={`${m.tag}:${m.name}`} className="ex-muscle-row">
              <span className="name">{m.name}</span>
              <span className={`tag ${m.tag}`}>{m.tag.toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
