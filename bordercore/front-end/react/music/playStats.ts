import { formatRelative } from "../utils/formatRelative";

interface PlayStatsFields {
  times_played?: number;
  last_time_played?: string | null;
}

/**
 * Format a song's play stats for the hover popup: "played 3 times · last 2d ago",
 * "played once · last 1h ago", or "never played".
 */
export function playStats(song: PlayStatsFields): string {
  const plays = song.times_played ?? 0;
  if (plays === 0) return "never played";
  const count = plays === 1 ? "played once" : `played ${plays} times`;
  const last = formatRelative(song.last_time_played);
  return last ? `${count} · last ${last}` : count;
}
