import { useLayoutEffect, useRef, useState } from "react";

// Tracks the rendered width of a chart container so SVG viewBoxes match real
// pixels and axis text stays at its intended size instead of scaling.
export function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measured = Math.round(node.getBoundingClientRect().width);
    if (measured) setWidth(measured);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
export function scale([d0, d1]: [number, number], [r0, r1]: [number, number]) {
  return (value: number) => r0 + ((value - d0) / (d1 - d0 || 1)) * (r1 - r0);
}
export function line(points: { x: number; y: number }[]) {
  return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}
export function dateTicks(days: unknown[]) {
  if (!days.length) return [];
  const last = days.length - 1;
  return [...new Set([0, 1, 2, 3, 4].map(k => Math.round((k * last) / 4)))].filter(i => i >= 0);
}
