import { describe, expect, it } from "vitest";

import { TAG_COLORS, TAG_COLOR_DEFAULT, tagSlug } from "./tagColors";

describe("TAG_COLORS map", () => {
  it("exposes every value as a valid 7-character hex code", () => {
    for (const [name, hex] of Object.entries(TAG_COLORS)) {
      expect(hex, `${name}=${hex}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("uses the documented default fallback color", () => {
    expect(TAG_COLOR_DEFAULT).toBe("#7c7fff");
  });
});

describe("tagSlug", () => {
  it("returns the tag name when it is a known color key", () => {
    expect(tagSlug("cyberpunk")).toBe("cyberpunk");
    expect(tagSlug("fitness")).toBe("fitness");
    expect(tagSlug("research")).toBe("research");
  });

  it("returns 'default' for unknown tags", () => {
    expect(tagSlug("not-a-real-tag")).toBe("default");
    expect(tagSlug("")).toBe("default");
  });

  it("is case-sensitive (matches the SCSS class generation)", () => {
    expect(tagSlug("Cyberpunk")).toBe("default");
    expect(tagSlug("CYBERPUNK")).toBe("default");
  });
});
