import { describe, expect, it } from "vitest";

import { boldenOption } from "./util.js";

describe("boldenOption", () => {
  describe("falsy inputs", () => {
    it("returns '' for undefined optionName", () => {
      expect(boldenOption(undefined, "foo")).toBe("");
    });

    it("returns '' for empty optionName", () => {
      expect(boldenOption("", "foo")).toBe("");
    });

    it("returns optionName unchanged for undefined substring", () => {
      expect(boldenOption("python", undefined)).toBe("python");
    });

    it("returns optionName unchanged for empty substring", () => {
      expect(boldenOption("python", "")).toBe("python");
    });
  });

  describe("matching behavior", () => {
    it("wraps a single match in <b> tags", () => {
      expect(boldenOption("python", "py")).toBe("<b>py</b>thon");
    });

    it("is case-insensitive", () => {
      expect(boldenOption("Python", "py")).toBe("<b>Py</b>thon");
      expect(boldenOption("python", "PY")).toBe("<b>py</b>thon");
    });

    it("returns optionName unchanged when substring does not match", () => {
      expect(boldenOption("python", "xyz")).toBe("python");
    });
  });

  describe("delimiter splitting", () => {
    it("splits substring on space and matches any token", () => {
      const result = boldenOption("django python", "dj py");
      expect(result).toContain("<b>dj</b>");
      expect(result).toContain("<b>py</b>");
    });

    it("splits substring on hyphen", () => {
      const result = boldenOption("foo bar", "foo-bar");
      expect(result).toContain("<b>foo</b>");
      expect(result).toContain("<b>bar</b>");
    });

    it("splits substring on underscore", () => {
      const result = boldenOption("foo bar", "foo_bar");
      expect(result).toContain("<b>foo</b>");
      expect(result).toContain("<b>bar</b>");
    });

    it("splits substring on forward slash, backslash, pipe, and dot", () => {
      for (const delim of ["/", "\\", "|", "."]) {
        const result = boldenOption("foo bar", `foo${delim}bar`);
        expect(result).toContain("<b>foo</b>");
        expect(result).toContain("<b>bar</b>");
      }
    });

    it("filters out empty tokens from consecutive delimiters", () => {
      // "foo--bar" splits into ["foo", "", "bar"]; the empty token must be
      // filtered, otherwise the regex would contain "|" with an empty
      // alternative and match between every character.
      expect(boldenOption("foobar", "foo--bar")).toBe("<b>foo</b><b>bar</b>");
    });
  });
});
