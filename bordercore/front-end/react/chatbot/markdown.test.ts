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

  it("highlights languages beyond the original allowlist (e.g. java)", () => {
    const html = renderMarkdown("```java\npublic class A { int x = 1; }\n```");
    expect(html).toContain("language-java");
    expect(html).toContain("hljs-keyword");
  });

  it("highlights languages beyond the original allowlist (e.g. go)", () => {
    const html = renderMarkdown("```go\nfunc main() { x := 1 }\n```");
    expect(html).toContain("language-go");
    expect(html).toMatch(/hljs-\w+/);
  });

  it("auto-highlights fenced code that has no language label", () => {
    const html = renderMarkdown('```\ndef greet(name):\n    return f"hi {name}"\n```');
    expect(html).toContain("hljs");
    expect(html).toMatch(/hljs-\w+/);
  });

  it("still wraps code in a pre.hljs block", () => {
    const html = renderMarkdown("```java\nint x = 1;\n```");
    expect(html).toContain('<pre class="hljs">');
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

  it.each([
    ["\\[", "\\]"],
    ["$$", "$$"],
  ])("protects multiline %s math from Markdown block parsing", (open, close) => {
    const formula = `${open}
\\text{MultiHead}(Q,K,V)
=
\\text{Concat}(\\text{head}_1,\\ldots,\\text{head}_h)W^O
${close}`;
    const html = renderMarkdown(`Formula:\n${formula}\n\nThe projection mixes heads.`);
    expect(html).toContain(formula);
    expect(html).not.toMatch(/<h[1-6]\b/);
    expect(html).toContain("<p>The projection mixes heads.</p>");
  });

  it("preserves math across blank lines and escapes HTML inside it", () => {
    const html = renderMarkdown("\\[\na_b\n\n< a & b\n---\n\\]");
    expect(html).toContain("\\[\na_b\n\n&lt; a &amp; b\n---\n\\]");
    expect(html).not.toContain("<hr");
  });

  it("preserves multiline math inside a list item", () => {
    const html = renderMarkdown("- Formula:\n  \\[\n  x\n  =\n  y\n  \\]\n- Next item");
    expect(html).toContain("\\[\nx\n=\ny\n\\]");
    expect(html).toContain("<li>Next item</li>");
    expect(html).not.toContain("<h1");
  });

  it("leaves math delimiters inside code as code", () => {
    for (const source of ["```text\n\\[\nx\n=\ny\n\\]\n```", "    \\[\n    x\n    \\]"]) {
      const html = renderMarkdown(source);
      expect(html).toContain("<pre");
      expect(html).toContain("<code");
      expect(html).not.toContain('class="math-block"');
    }
  });

  it("does not consume following Markdown for incomplete streamed math", () => {
    const html = renderMarkdown("\\[\nx\n\n**Still streaming**");
    expect(html).toContain("<strong>Still streaming</strong>");
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
