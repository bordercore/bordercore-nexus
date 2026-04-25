import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("chatbot markdown", () => {
  it("renders basic markdown", () => {
    const html = renderMarkdown("**bold** and *italic*");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("highlights python code blocks", () => {
    const html = renderMarkdown("```python\ndef hi():\n    return 1\n```");
    expect(html).toContain("hljs");
    expect(html).toContain("language-python");
  });

  it("highlights javascript code blocks", () => {
    const html = renderMarkdown("```javascript\nconst x = 1;\n```");
    expect(html).toContain("hljs");
    expect(html).toContain("language-javascript");
  });

  it("falls back to plaintext for unknown languages", () => {
    const html = renderMarkdown("```rust\nfn main() {}\n```");
    expect(html).toContain("<pre");
    expect(html).toContain("<code");
  });

  it("strips raw script tags", () => {
    const html = renderMarkdown("<script>alert(1)</script>hello");
    expect(html).not.toContain("<script");
    expect(html).toContain("hello");
  });

  it("strips javascript: hrefs", () => {
    const html = renderMarkdown('<a href="javascript:alert(1)">x</a>');
    expect(html).not.toMatch(/href=["']javascript:/);
  });
});
