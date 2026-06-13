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

  it("strips all on* event handlers (not just a hardcoded subset)", () => {
    const handlers = ["onmouseover", "onfocus", "onblur", "onkeydown"];
    for (const handler of handlers) {
      const html = renderMarkdown(`<img src="x" ${handler}="alert(1)">`);
      expect(html).not.toContain(handler);
    }
  });

  it("preserves \\[...\\] display-math delimiters for MathJax", () => {
    const html = renderMarkdown(
      "Formula:\n\n\\[ \\text{IDF}(t) = \\log\\left(\\frac{N}{\\text{DF}(t)} + 1\\right) \\]"
    );
    expect(html).toContain("\\[");
    expect(html).toContain("\\]");
    expect(html).toContain("\\frac{N}{\\text{DF}(t)}");
  });

  it("preserves \\(...\\) inline-math delimiters for MathJax", () => {
    const html = renderMarkdown("The term \\( x_1 \\) is the first.");
    expect(html).toContain("\\(");
    expect(html).toContain("\\)");
    expect(html).toContain("x_1");
  });

  it("preserves $$...$$ inline-math delimiters for MathJax", () => {
    const html = renderMarkdown("Energy is $$ _x_ + y^2^ $$ here.");
    expect(html).toContain("$$ _x_ + y^2^ $$");
    expect(html).not.toContain("<em>");
    expect(html).not.toContain("<sup>");
  });

  it("shields math interior from markdown emphasis and superscript", () => {
    const html = renderMarkdown("\\( a_b a^c^ \\)");
    expect(html).not.toContain("<em>");
    expect(html).not.toContain("<sup>");
    expect(html).toContain("a_b a^c^");
  });

  it("HTML-escapes special characters inside math", () => {
    const html = renderMarkdown("\\( a < b & c \\)");
    expect(html).toContain("\\(");
    expect(html).toContain("\\)");
    expect(html).toContain("&lt;");
    expect(html).toContain("&amp;");
    expect(html).not.toMatch(/<\s*b\b/); // "< b" must not become a tag
  });

  it("does not treat single-dollar amounts as math", () => {
    const html = renderMarkdown("It costs $5 and then $10 total.");
    expect(html).toContain("$5");
    expect(html).toContain("$10");
  });
});
