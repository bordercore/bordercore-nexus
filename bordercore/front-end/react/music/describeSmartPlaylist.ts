import type { PlaylistParameters } from "./types";

export function describeSmartPlaylist(params: PlaylistParameters | undefined): string {
  if (!params) return "";
  const parts: string[] = [];
  if (params.tag) parts.push(`tag:${params.tag}`);
  if (params.rating) parts.push(`★${params.rating}`);
  if (params.start_year && params.end_year) {
    parts.push(`${params.start_year}–${params.end_year}`);
  }
  if (params.exclude_albums) parts.push("¬album");
  if (params.exclude_recent) parts.push(`¬${params.exclude_recent}d`);
  if (params.sort_by === "random") parts.push("↻random");
  return parts.join(" · ");
}
