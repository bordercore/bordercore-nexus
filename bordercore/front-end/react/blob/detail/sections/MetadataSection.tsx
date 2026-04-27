import React from "react";

interface MetadataSectionProps {
  metadata: Record<string, string>;
}

export function MetadataSection({ metadata }: MetadataSectionProps) {
  const entries = Object.entries(metadata || {});
  if (entries.length === 0) return null;
  return (
    <div className="bd-rail-section">
      <h3>Metadata</h3>
      <div className="bd-props">
        {entries.map(([k, v]) => (
          <div key={k} className="bd-prop">
            <span className="k">{k}</span>
            <span className="v dim">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MetadataSection;
