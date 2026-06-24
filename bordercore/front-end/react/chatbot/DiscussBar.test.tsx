import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiscussBar } from "./DiscussBar";

describe("DiscussBar", () => {
  it("renders the answer, explain, and related chips", () => {
    render(
      <DiscussBar
        onAnswer={vi.fn()}
        onExplain={vi.fn()}
        onRelated={vi.fn()}
        disabled={false}
        showHint={false}
      />
    );
    expect(screen.getByRole("button", { name: "Answer this question" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explain the concepts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask related question" })).toBeInTheDocument();
  });

  it("calls onAnswer, onExplain, and onRelated when the respective chips are clicked", async () => {
    const onAnswer = vi.fn();
    const onExplain = vi.fn();
    const onRelated = vi.fn();
    render(
      <DiscussBar
        onAnswer={onAnswer}
        onExplain={onExplain}
        onRelated={onRelated}
        disabled={false}
        showHint={false}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Answer this question" }));
    await userEvent.click(screen.getByRole("button", { name: "Explain the concepts" }));
    await userEvent.click(screen.getByRole("button", { name: "Ask related question" }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onExplain).toHaveBeenCalledTimes(1);
    expect(onRelated).toHaveBeenCalledTimes(1);
  });

  it("disables all chips when disabled", () => {
    render(
      <DiscussBar
        onAnswer={vi.fn()}
        onExplain={vi.fn()}
        onRelated={vi.fn()}
        disabled={true}
        showHint={false}
      />
    );
    expect(screen.getByRole("button", { name: "Answer this question" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Explain the concepts" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ask related question" })).toBeDisabled();
  });

  it("shows the hint only when showHint is true", () => {
    const { rerender } = render(
      <DiscussBar
        onAnswer={vi.fn()}
        onExplain={vi.fn()}
        onRelated={vi.fn()}
        disabled={false}
        showHint={false}
      />
    );
    expect(screen.queryByText(/Ask anything about this question/)).not.toBeInTheDocument();
    rerender(
      <DiscussBar
        onAnswer={vi.fn()}
        onExplain={vi.fn()}
        onRelated={vi.fn()}
        disabled={false}
        showHint={true}
      />
    );
    expect(screen.getByText(/Ask anything about this question/)).toBeInTheDocument();
  });
});
