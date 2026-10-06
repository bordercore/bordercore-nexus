// Bundled separately and embedded in served/downloaded lessons: no network or fonts.
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { AsciiMath } from "mathjax-full/js/input/asciimath.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { browserAdaptor } from "mathjax-full/js/adaptors/browserAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

RegisterHTMLHandler(browserAdaptor());
const output = () => new SVG({ fontCache: "local" });
const tex = mathjax.document(document, {
  InputJax: new TeX({
    packages: AllPackages.filter(name => !["autoload", "require"].includes(name)),
    inlineMath: [["\\(", "\\)"]],
    displayMath: [
      ["\\[", "\\]"],
      ["$$", "$$"],
    ],
    processEscapes: true,
  }),
  OutputJax: output(),
});
const ascii = mathjax.document(document, {
  InputJax: new AsciiMath(),
  OutputJax: output(),
});

function render() {
  // Only infer legacy notation in explicitly styled formulas or mathematical code.
  // Leave programming examples, prose, and live controls intact.
  document.querySelectorAll(".formula, .equation, code").forEach(element => {
    if (element.children.length || element.closest("pre, mjx-container")) return;
    const text = element.textContent.trim();
    if (!text || /\\[([]|\$/.test(text)) return;
    if (
      !/[=≈∝]|\^\(/.test(text) ||
      /[;{}]|=>|===|console\.|\b(return|const|let|function)\b/.test(text)
    )
      return;
    if (element.matches("code") && !/[≈∝]|\^\(/.test(text)) return;
    try {
      const rendered = text.split(/\n+/).map(line => {
        const notation = line
          .trim()
          .replace(/^([A-Za-z]+(?: [A-Za-z]+)*) ([a-zA-Z](?:_\w+)?)\s*(?=[≈=])/, '"$1 " $2 ')
          .replace(/−/g, "-")
          .replace(/≈/g, " approx ")
          .replace(/·/g, " cdot ")
          .replace(/²/g, "^2")
          .replace(/→/g, " rarr ");
        return ascii.convert(notation, { display: !element.matches("code") });
      });
      element.replaceChildren(...rendered);
    } catch (error) {
      console.warn("Lumen could not render a legacy formula", error);
    }
  });
  tex.findMath().compile().getMetrics().typeset().updateDocument();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", render, { once: true });
} else {
  render();
}
