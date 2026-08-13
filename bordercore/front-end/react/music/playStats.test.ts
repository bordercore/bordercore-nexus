import { describe, expect, it } from "vitest";
import { playStats } from "./playStats";

describe("playStats", () => {
  it("formats a play count with a relative last-played time", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(playStats({ times_played: 3, last_time_played: twoDaysAgo })).toBe(
      "played 3 times · last 2d ago"
    );
  });

  it("uses singular phrasing for a single play", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(playStats({ times_played: 1, last_time_played: oneHourAgo })).toBe(
      "played once · last 1h ago"
    );
  });

  it("returns never played for zero plays", () => {
    expect(playStats({ times_played: 0, last_time_played: null })).toBe("never played");
  });

  it("treats missing fields as never played", () => {
    expect(playStats({})).toBe("never played");
  });

  it("omits the last-played segment when the timestamp is missing", () => {
    expect(playStats({ times_played: 2, last_time_played: null })).toBe("played 2 times");
  });
});
