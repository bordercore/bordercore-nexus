import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { renderInlineMarkdown } from "./markdown";

function rendered(source: string): HTMLElement {
  const { container } = render(<div>{renderInlineMarkdown(source)}</div>);
  return container.firstChild as HTMLElement;
}

describe("renderInlineMarkdown", () => {
  it("renders plain text as-is", () => {
    expect(rendered("hello world").textContent).toBe("hello world");
  });

  it("renders emphasis", () => {
    const el = rendered("hello *world*");
    expect(el.querySelector("em")?.textContent).toBe("world");
  });

  it("renders strong text", () => {
    const el = rendered("**bold** rest");
    expect(el.querySelector("strong")?.textContent).toBe("bold");
  });

  it("renders strikethrough", () => {
    const el = rendered("~~gone~~ here");
    expect(el.querySelector("s")?.textContent).toBe("gone");
  });

  it("renders inline code", () => {
    const el = rendered("use `npm test` now");
    expect(el.querySelector("code")?.textContent).toBe("npm test");
  });

  it("renders explicit markdown links with target=_blank and rel=noopener", () => {
    const el = rendered("see [docs](https://example.com/x)");
    const a = el.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://example.com/x");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(a?.textContent).toBe("docs");
  });

  it("autolinks bare URLs via linkify", () => {
    const el = rendered("see https://example.com here");
    const a = el.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://example.com");
  });

  it("nests emphasis inside strong", () => {
    const el = rendered("**bold *and italic***");
    const strong = el.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong?.querySelector("em")?.textContent).toBe("and italic");
  });

  it("collapses softbreaks to spaces", () => {
    const el = rendered("line one\nline two");
    expect(el.textContent).toBe("line one line two");
  });

  it("escapes raw HTML (html: false)", () => {
    const el = rendered("<script>alert(1)</script>");
    expect(el.querySelector("script")).toBeNull();
    expect(el.textContent).toContain("<script>");
  });

  it("renders an empty string without crashing", () => {
    expect(rendered("").textContent).toBe("");
  });
});
