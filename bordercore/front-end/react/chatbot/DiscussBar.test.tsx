import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiscussBar } from "./DiscussBar";

describe("DiscussBar", () => {
  it("renders the answer and explain chips", () => {
    render(<DiscussBar onAnswer={vi.fn()} onExplain={vi.fn()} disabled={false} showHint={false} />);
    expect(screen.getByRole("button", { name: "Answer this question" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explain the concepts" })).toBeInTheDocument();
  });

  it("calls onAnswer and onExplain when the respective chips are clicked", async () => {
    const onAnswer = vi.fn();
    const onExplain = vi.fn();
    render(
      <DiscussBar onAnswer={onAnswer} onExplain={onExplain} disabled={false} showHint={false} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Answer this question" }));
    await userEvent.click(screen.getByRole("button", { name: "Explain the concepts" }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onExplain).toHaveBeenCalledTimes(1);
  });

  it("disables both chips when disabled", () => {
    render(<DiscussBar onAnswer={vi.fn()} onExplain={vi.fn()} disabled={true} showHint={false} />);
    expect(screen.getByRole("button", { name: "Answer this question" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Explain the concepts" })).toBeDisabled();
  });

  it("shows the hint only when showHint is true", () => {
    const { rerender } = render(
      <DiscussBar onAnswer={vi.fn()} onExplain={vi.fn()} disabled={false} showHint={false} />
    );
    expect(screen.queryByText(/Ask anything about this question/)).not.toBeInTheDocument();
    rerender(
      <DiscussBar onAnswer={vi.fn()} onExplain={vi.fn()} disabled={false} showHint={true} />
    );
    expect(screen.getByText(/Ask anything about this question/)).toBeInTheDocument();
  });
});
