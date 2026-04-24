import React from "react";

const hiddenSvgStyle = { position: "absolute" as const };

export default function RingDefs() {
  return (
    // position: absolute must remain inline — zero-size SVG defs must not affect layout flow
    <svg width="0" height="0" style={hiddenSvgStyle} aria-hidden>
      <defs>
        <linearGradient id="ringPurple" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--bc-accent-2)" />
        </linearGradient>
        <linearGradient id="ringCyan" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--bc-accent-4)" />
          <stop offset="100%" stopColor="var(--bc-accent-2)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
