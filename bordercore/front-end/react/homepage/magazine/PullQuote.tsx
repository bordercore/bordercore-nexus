import React from "react";
import type { Quote } from "../types";

interface PullQuoteProps {
  quote: Quote | null;
}

export function PullQuote({ quote }: PullQuoteProps) {
  if (!quote) return null;
  return (
    <div className="mag-pull-quote">
      “{quote.quote}”<div className="mag-pull-quote-attr">— {quote.source}</div>
    </div>
  );
}
