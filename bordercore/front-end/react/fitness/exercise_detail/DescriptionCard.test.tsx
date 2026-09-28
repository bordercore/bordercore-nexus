import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DescriptionCard } from "./DescriptionCard";

function renderDescription(description: string) {
  return render(
    <DescriptionCard
      description={description}
      note=""
      exerciseUuid="exercise-uuid"
      editNoteUrl="/edit-note/"
    />
  );
}

describe("DescriptionCard", () => {
  it("renders Markdown in the exercise description", () => {
    renderDescription(
      "## Technique\n\nUse **control** and *pause* with `tempo`.\n\n- [Instructions](https://example.com)\n- Repeat"
    );

    expect(screen.getByRole("heading", { name: "Technique", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("control").tagName).toBe("STRONG");
    expect(screen.getByText("pause").tagName).toBe("EM");
    expect(screen.getByText("tempo").tagName).toBe("CODE");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Instructions" })).toHaveAttribute(
      "href",
      "https://example.com"
    );
  });

  it("keeps raw HTML and unsafe links inert", () => {
    const { container } = renderDescription(
      '<img src=x onerror="alert(1)"> [unsafe](javascript:alert(1))'
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(container).toHaveTextContent('<img src=x onerror="alert(1)">');
  });

  it("keeps the empty-description placeholder", () => {
    renderDescription("   ");
    expect(screen.getByText("no description")).toBeInTheDocument();
  });
});
