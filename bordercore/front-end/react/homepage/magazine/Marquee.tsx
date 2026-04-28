import React from "react";
import type { Quote } from "../types";

interface MarqueeProps {
  quote: Quote | null;
}

export function Marquee({ quote }: MarqueeProps) {
  if (!quote) return null;

  const item = (key: string) => (
    <React.Fragment key={key}>
      <span className="mag-marquee-q">"{quote.quote}"</span>
      <span className="mag-marquee-a">— {quote.source}</span>
      <span aria-hidden="true">·</span>
    </React.Fragment>
  );

  // Duplicate the track so the linear translateX(-50%) loop is seamless.
  const items = [0, 1, 2, 3, 4, 5, 6, 7].map(i => item(`m-${i}`));

  return (
    <div className="mag-marquee" aria-label="Quote of the day">
      <div className="mag-marquee-track">{items}</div>
    </div>
  );
}
