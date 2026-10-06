import { describe, expect, it } from "vitest";
import { renderOriginalDrill } from "./originalDrillMarkdown";

describe("original drill Markdown", () => {
  it.each([false, true])("renders saved source text (legacy: %s)", legacy => {
    document.body.innerHTML = `<section id="lumen-review">
      <details><summary>Follow-up</summary><p>**Unchanged**</p></details>
      <h3>Question</h3>${legacy ? "<p>" : '<div data-lumen-source="question">'}${legacy ? "</p>" : "</div>"}
      <details><summary>Original answer</summary>${legacy ? "<p></p>" : '<div data-lumen-source="answer"></div>'}</details>
    </section>`;
    const review = document.querySelector("#lumen-review")!;
    review.querySelector("h3")!.nextElementSibling!.textContent = "**Explain** *this*";
    review.querySelector("details:last-child")!.lastElementChild!.textContent =
      "- First\n- Second\n\n```python\nx = 2\n```\n\n\\[\nx_1\n=\ny^2\n\\]\n\n<script>alert(1)</script>\n\n[Link](https://example.com) ![Alt](https://example.com/image.png)";
    renderOriginalDrill();
    expect(review.querySelector(".lumen-source-markdown strong")?.textContent).toBe("Explain");
    expect(review.querySelectorAll(".lumen-source-markdown li")).toHaveLength(2);
    expect(review.querySelector("pre code")?.textContent).toBe("x = 2\n");
    expect(review.querySelector(".math-block")?.textContent).toContain("\\[\nx_1\n=\ny^2\n\\]");
    expect(review.querySelector("script, img, a")).toBeNull();
    expect(review.textContent).toContain("<script>alert(1)</script>");
    expect(review.querySelector("details p")?.textContent).toBe("**Unchanged**");
    const html = review.innerHTML;
    renderOriginalDrill();
    expect(review.innerHTML).toBe(html);
  });
});
