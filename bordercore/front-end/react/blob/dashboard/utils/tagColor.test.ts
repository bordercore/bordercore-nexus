import { describe, expect, it } from "vitest";

import { tagColor, tagHue } from "./tagColor";

describe("tagHue", () => {
  it("is deterministic", () => {
    expect(tagHue("python")).toBe(tagHue("python"));
    expect(tagHue("django")).toBe(tagHue("django"));
  });

  it("is case-insensitive", () => {
    expect(tagHue("Python")).toBe(tagHue("python"));
    expect(tagHue("DJANGO")).toBe(tagHue("django"));
  });

  it("produces an integer hue in [0, 360)", () => {
    const inputs = [
      "",
      "a",
      "python",
      "django",
      "react",
      "a very long tag name",
      "!@#$%^&*()",
      "日本語",
    ];
    for (const tag of inputs) {
      const h = tagHue(tag);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });

  it("produces different hues for different tags (spot check)", () => {
    expect(tagHue("python")).not.toBe(tagHue("django"));
  });
});

describe("tagColor", () => {
  it("returns an oklch() string that includes the tag's hue", () => {
    const color = tagColor("python");
    expect(color).toBe(`oklch(70% 0.13 ${tagHue("python")})`);
  });
});
