import React from "react";
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token";

const md = MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

function attr(token: Token, name: string): string | undefined {
  return token.attrs?.find(([k]) => k === name)?.[1];
}

function walk(tokens: Token[], keyBase = ""): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    const key = `${keyBase}${i}`;
    if (t.type === "text") {
      out.push(t.content);
      i++;
      continue;
    }
    if (t.type === "code_inline") {
      out.push(<code key={key}>{t.content}</code>);
      i++;
      continue;
    }
    if (t.type === "softbreak" || t.type === "hardbreak") {
      out.push(" ");
      i++;
      continue;
    }
    if (t.type.endsWith("_open")) {
      const closeType = t.type.replace("_open", "_close");
      let depth = 1;
      let j = i + 1;
      while (j < tokens.length && depth > 0) {
        if (tokens[j].type === t.type) depth++;
        else if (tokens[j].type === closeType) depth--;
        if (depth === 0) break;
        j++;
      }
      const inner = walk(tokens.slice(i + 1, j), `${key}-`);
      if (t.tag === "em") out.push(<em key={key}>{inner}</em>);
      else if (t.tag === "strong") out.push(<strong key={key}>{inner}</strong>);
      else if (t.tag === "s") out.push(<s key={key}>{inner}</s>);
      else if (t.tag === "a") {
        const href = attr(t, "href") ?? "";
        out.push(
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {inner}
          </a>
        );
      } else {
        out.push(...inner);
      }
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}

export function renderInlineMarkdown(source: string): React.ReactNode {
  const inline = md.parseInline(source, {})[0];
  if (!inline?.children) return source;
  return walk(inline.children);
}
