import type MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import { createMarkdown } from "../common/markdown";
import { mathProtect } from "./mathProtect";
import hljs from "highlight.js/lib/core";

import python from "highlight.js/lib/languages/python";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import java from "highlight.js/lib/languages/java";
import go from "highlight.js/lib/languages/go";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import rust from "highlight.js/lib/languages/rust";
import ruby from "highlight.js/lib/languages/ruby";
import php from "highlight.js/lib/languages/php";
import kotlin from "highlight.js/lib/languages/kotlin";
import swift from "highlight.js/lib/languages/swift";
import scala from "highlight.js/lib/languages/scala";
import lua from "highlight.js/lib/languages/lua";
import markdown from "highlight.js/lib/languages/markdown";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import ini from "highlight.js/lib/languages/ini";
import plaintext from "highlight.js/lib/languages/plaintext";

// `registerLanguage` accepts aliases as a side effect of the language module,
// but we also register the short aliases we commonly see in fenced blocks.
hljs.registerLanguage("python", python);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("java", java);
hljs.registerLanguage("go", go);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c++", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("cs", csharp);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("rs", rust);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("rb", ruby);
hljs.registerLanguage("php", php);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("kt", kotlin);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("scala", scala);
hljs.registerLanguage("lua", lua);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("toml", ini);
hljs.registerLanguage("plaintext", plaintext);

// Escape HTML entities — used in the highlight callback so we don't create
// a circular reference by accessing md.utils inside md's own initializer.
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const md: MarkdownIt = createMarkdown({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str: string, lang: string): string => {
    // Explicit, recognized language: highlight with it.
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code class="language-${lang}">${
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
        }</code></pre>`;
      } catch {
        // fall through to auto-detection
      }
    }
    // No language, or an unrecognized one (e.g. a less common language, or an
    // unlabeled block): auto-detect among the registered languages so every
    // code block still gets highlighted.
    try {
      const auto = hljs.highlightAuto(str);
      const cls = auto.language ? ` class="language-${auto.language}"` : "";
      return `<pre class="hljs"><code${cls}>${auto.value}</code></pre>`;
    } catch {
      return `<pre class="hljs"><code>${escapeHtml(str)}</code></pre>`;
    }
  },
});

mathProtect(md);

// DOMPurify defaults already strip all on* event handlers and javascript:
// hrefs. We add a few belt-and-suspenders FORBID_TAGS for clarity (script
// is in the default list; iframe/object/embed are not). Do NOT add
// FORBID_ATTR — it REPLACES (not augments) the default attribute blocklist
// and would silently allow on* handlers other than the listed three.
const PURIFY_CONFIG = {
  ADD_ATTR: ["target"],
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
};

export function renderMarkdown(source: string): string {
  const raw = md.render(source);
  return DOMPurify.sanitize(raw, PURIFY_CONFIG);
}
