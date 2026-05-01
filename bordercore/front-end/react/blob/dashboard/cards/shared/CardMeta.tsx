import React from "react";

interface CardMetaProps {
  parts: (string | null | false | undefined)[];
}

export function CardMeta({ parts }: CardMetaProps) {
  const visible = parts.filter((p): p is string => Boolean(p));
  if (visible.length === 0) return null;
  return (
    <div className="rb-card-meta">
      {visible.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="rb-card-meta-sep">·</span>}
          <span>{part}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

export default CardMeta;
