import { describe, expect, it } from "vitest";
import { createMarkdown } from "./markdown";

describe("createMarkdown", () => {
  it("renders ^text^ as superscript", () => {
    const md = createMarkdown();
    expect(md.render("E = mc^2^")).toContain("mc<sup>2</sup>");
  });

  it("does not render superscript across whitespace", () => {
    const md = createMarkdown();
    expect(md.render("a^b c^d")).not.toContain("<sup>");
  });

  it("escapes raw HTML by default", () => {
    const md = createMarkdown();
    expect(md.render("<sup>2</sup>")).not.toContain("<sup>");
  });

  it("passes constructor options through", () => {
    const md = createMarkdown({ html: true });
    expect(md.render("<sup>2</sup>")).toContain("<sup>2</sup>");
  });
});
