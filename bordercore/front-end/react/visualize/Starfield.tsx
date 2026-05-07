import React, { useMemo } from "react";

interface StarfieldProps {
  width: number;
  height: number;
  count?: number;
  seed?: number;
}

/**
 * Fixed-position background stars. Deterministic per seed so the starfield
 * stays stable across re-renders. The fill stays a fixed white because the
 * constellation viewer is intentionally fixed-palette; see the header doc
 * in static/scss/pages/_visualize.scss for the rationale.
 */
export function Starfield({ width, height, count = 150, seed = 42 }: StarfieldProps) {
  const stars = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: rand() * width,
      y: rand() * height,
      r: 0.3 + rand() * 0.7,
      opacity: 0.15 + rand() * 0.35,
    }));
  }, [width, height, count, seed]);

  return (
    <g pointerEvents="none">
      {stars.map(s => (
        <circle key={s.id} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" opacity={s.opacity} />
      ))}
    </g>
  );
}

// Tiny seeded PRNG — good enough for static scatter.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export default Starfield;
