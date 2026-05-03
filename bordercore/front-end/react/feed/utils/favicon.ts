import type { Feed } from "../types";

const HUE_BUCKETS = 24;

export function feedHueBucket(feed: Feed): number {
  let h = 0;
  for (let i = 0; i < feed.uuid.length; i++) {
    h = (h * 31 + feed.uuid.charCodeAt(i)) >>> 0;
  }
  return h % HUE_BUCKETS;
}

export function feedHueClass(feed: Feed): string {
  return `tp-favicon--hue-${feedHueBucket(feed)}`;
}

export function feedInitials(name: string): string {
  const stem = name.replace(/^Reddit\s+/i, "").trim();
  const parts = stem.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return stem.slice(0, 2).toUpperCase();
}
