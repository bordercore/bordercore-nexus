import { describe, expect, it } from "vitest";

import type { Feed } from "../types";
import { feedHueBucket, feedHueClass, feedInitials } from "./favicon";

function makeFeed(overrides: Partial<Feed> = {}): Feed {
  return {
    id: 1,
    uuid: "00000000-0000-0000-0000-000000000000",
    name: "Example",
    homepage: null,
    url: "https://example.com/feed",
    lastCheck: null,
    lastResponse: null,
    lastResponseCode: null,
    feedItems: [],
    ...overrides,
  };
}

describe("feedHueBucket", () => {
  it("is deterministic for the same uuid", () => {
    const f = makeFeed({ uuid: "abc-123" });
    expect(feedHueBucket(f)).toBe(feedHueBucket(f));
  });

  it("returns an integer in [0, 24)", () => {
    const uuids = [
      "00000000-0000-0000-0000-000000000000",
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
      "abc",
      "z",
      "feed-with-a-long-uuid-string-here",
    ];
    for (const uuid of uuids) {
      const bucket = feedHueBucket(makeFeed({ uuid }));
      expect(Number.isInteger(bucket)).toBe(true);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(24);
    }
  });

  it("distinguishes different uuids (spot check)", () => {
    expect(feedHueBucket(makeFeed({ uuid: "alpha" }))).not.toBe(
      feedHueBucket(makeFeed({ uuid: "beta" }))
    );
  });
});

describe("feedHueClass", () => {
  it("returns the tp-favicon--hue-N class", () => {
    const f = makeFeed({ uuid: "abc" });
    expect(feedHueClass(f)).toBe(`tp-favicon--hue-${feedHueBucket(f)}`);
  });
});

describe("feedInitials", () => {
  it("uses the first letters of the first two words", () => {
    expect(feedInitials("Hacker News")).toBe("HN");
    expect(feedInitials("The Verge")).toBe("TV");
  });

  it("strips a leading 'Reddit ' before deriving initials", () => {
    expect(feedInitials("Reddit programming")).toBe("PR");
    expect(feedInitials("Reddit Python Django")).toBe("PD");
  });

  it("falls back to the first two characters for single-word names", () => {
    expect(feedInitials("python")).toBe("PY");
    expect(feedInitials("X")).toBe("X");
  });

  it("collapses runs of whitespace", () => {
    expect(feedInitials("Hacker    News")).toBe("HN");
  });
});
