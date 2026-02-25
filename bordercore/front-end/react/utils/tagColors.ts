import type { CSSProperties } from "react";

/** djb2 hash → hue 0-360 */
function hashTagName(name: string): number {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 33) ^ name.charCodeAt(i);
  }
  return ((hash % 360) + 360) % 360;
}

/** Returns inline style that sets --tag-hue for a given tag name. */
export function tagStyle(name: string): CSSProperties {
  return { "--tag-hue": hashTagName(name) } as CSSProperties;
}
