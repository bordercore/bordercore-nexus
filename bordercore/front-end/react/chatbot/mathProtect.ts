import type MarkdownIt from "markdown-it";
import type StateInline from "markdown-it/lib/rules_inline/state_inline";

// markdown-it strips the backslashes from MathJax delimiters (`\[`, `\]`,
// `\(`, `\)`) because it treats them as escaped punctuation, and it mangles
// math interiors (underscores become emphasis, `^...^` becomes superscript).
// By the time the page's MathJax runs, there is nothing left to typeset.
//
// This plugin claims math spans as a single inline token BEFORE the escape /
// emphasis / sup rules run, then re-emits the original delimiters verbatim so
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
  const mathRule = (state: StateInline, silent: boolean): boolean => {
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
