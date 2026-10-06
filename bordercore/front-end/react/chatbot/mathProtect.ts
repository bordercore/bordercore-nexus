import type MarkdownIt from "markdown-it";

// markdown-it strips the backslashes from MathJax delimiters (`\[`, `\]`,
// `\(`, `\)`) because it treats them as escaped punctuation, and it mangles
// math interiors (underscores become emphasis, `^...^` becomes superscript).
// By the time the page's MathJax runs, there is nothing left to typeset.
//
// This plugin claims math blocks before Markdown block parsing (an isolated
// `=` in a formula would otherwise create a heading), and math spans before
// the inline escape / emphasis / sup rules. It re-emits the delimiters so
// MathJax can find and typeset them after the HTML is mounted. The interior is
// HTML-escaped (never markdown-processed), keeping it both safe and intact.
//
// Delimiters mirror the page's MathJax config (see drill/question.html):
// inline `\(...\)` and `$$...$$`, display `\[...\]`. Single `$` is deliberately
// not a delimiter, so currency amounts ("$5") are left alone.
interface MathDelimiter {
  open: string;
  close: string;
}

const DELIMITERS: MathDelimiter[] = [
  { open: "$$", close: "$$" },
  { open: "\\[", close: "\\]" },
  { open: "\\(", close: "\\)" },
];

export function mathProtect(md: MarkdownIt): void {
  md.block.ruler.before(
    "fence",
    "math_block",
    (state, startLine, endLine, silent) => {
      // Respect indented code blocks, including those nested in lists.
      if (state.sCount[startLine] - state.blkIndent >= 4) return false;
      const firstLine = state.src.slice(
        state.bMarks[startLine] + state.tShift[startLine],
        state.eMarks[startLine]
      );
      const delimiter = DELIMITERS.find(({ open }) => firstLine.startsWith(open));
      if (!delimiter) return false;

      const lines: string[] = [];
      for (let line = startLine; line < endLine; line++) {
        // Do not search outside the containing list or blockquote.
        if (!state.isEmpty(line) && state.sCount[line] < state.blkIndent) break;
        const text =
          line === startLine ? firstLine : state.getLines(line, line + 1, state.blkIndent, false);
        lines.push(text);
        const closeIdx = text.indexOf(
          delimiter.close,
          line === startLine ? delimiter.open.length : 0
        );
        if (closeIdx === -1) continue;
        // Leave math followed by prose on the same line to the inline rule.
        if (text.slice(closeIdx + delimiter.close.length).trim()) return false;
        const content = lines.join("\n").trimEnd();
        if (!content.slice(delimiter.open.length, -delimiter.close.length).trim()) return false;
        if (silent) return true;

        const token = state.push("math_block", "div", 0);
        token.block = true;
        token.content = content;
        token.map = [startLine, line + 1];
        state.line = line + 1;
        return true;
      }
      return false;
    },
    { alt: ["paragraph", "reference", "blockquote", "list"] }
  );

  md.renderer.rules.math_block = (tokens, idx) =>
    `<div class="math-block">${md.utils.escapeHtml(tokens[idx].content)}</div>\n`;

  const mathRule = (state: MarkdownIt.StateInline, silent: boolean): boolean => {
    const { src, pos } = state;

    for (const { open, close } of DELIMITERS) {
      if (!src.startsWith(open, pos)) continue;

      const contentStart = pos + open.length;
      const closeIdx = src.indexOf(close, contentStart);
      if (closeIdx === -1) continue;

      const content = src.slice(contentStart, closeIdx);
      if (content.trim().length === 0) continue;

      if (!silent) {
        const token = state.push("math", "", 0);
        token.markup = open;
        token.content = content;
        token.meta = { close };
      }
      state.pos = closeIdx + close.length;
      return true;
    }

    return false;
  };

  md.inline.ruler.before("escape", "math", mathRule);

  md.renderer.rules.math = (tokens, idx) => {
    const token = tokens[idx];
    const close = (token.meta as { close: string }).close;
    return token.markup + md.utils.escapeHtml(token.content) + close;
  };
}

export default mathProtect;
