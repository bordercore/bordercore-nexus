import { describe, expect, it } from "vitest";

import { tagStyle } from "./tagColors";

const hue = (name: string): number => (tagStyle(name) as { "--tag-hue": number })["--tag-hue"];

describe("tagStyle", () => {
  it("sets the --tag-hue CSS custom property", () => {
    const style = tagStyle("anything");
    expect(style).toHaveProperty("--tag-hue");
  });

  it("is deterministic: same input produces the same hue", () => {
    expect(hue("python")).toBe(hue("python"));
    expect(hue("django")).toBe(hue("django"));
  });

  it("produces a hue in the [0, 360) range", () => {
    const inputs = [
      "",
      "a",
      "python",
      "django",
      "react",
      "a very long tag name with spaces",
      "!@#$%^&*()",
      "日本語",
    ];
    for (const name of inputs) {
      const h = hue(name);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
      expect(Number.isInteger(h)).toBe(true);
    }
  });

  it("pins the hue for 'a' to guard against hash algorithm drift", () => {
    expect(hue("a")).toBe(124);
  });

  it("produces different hues for different inputs (spot check)", () => {
    expect(hue("python")).not.toBe(hue("django"));
  });
});
