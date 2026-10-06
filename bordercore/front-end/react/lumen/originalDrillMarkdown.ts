import { createMarkdown } from "../common/markdown";
import { mathProtect } from "../chatbot/mathProtect";

const markdown = createMarkdown({ html: false });
mathProtect(markdown);
// Preserve labels without introducing navigation or external resource requests.
markdown.renderer.rules.link_open = () => "";
markdown.renderer.rules.link_close = () => "";
markdown.renderer.rules.image = (tokens, index) => markdown.utils.escapeHtml(tokens[index].content);

export function renderOriginalDrill(root: ParentNode = document): void {
  const review = root.querySelector("#lumen-review");
  if (!review) return;

  // Older saved lessons have plain paragraphs instead of explicit source markers.
  const question =
    review.querySelector('[data-lumen-source="question"]') ??
    review.querySelector(":scope > h3")?.nextElementSibling;
  const answer =
    review.querySelector('[data-lumen-source="answer"]') ??
    review.querySelector(":scope > details:last-child > p");

  for (const source of [question, answer]) {
    if (!source || source.classList.contains("lumen-source-markdown")) continue;
    const rendered = document.createElement("div");
    rendered.className = "lumen-source-markdown";
    rendered.innerHTML = markdown.render(source.textContent ?? "");
    source.replaceWith(rendered);
  }
}
