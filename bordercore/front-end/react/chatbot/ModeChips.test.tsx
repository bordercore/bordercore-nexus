import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModeChips } from "./ModeChips";

describe("ModeChips", () => {
  it("renders only chat and notes when no blob context", () => {
    render(<ModeChips mode="chat" hasBlobContext={false} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "chat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "notes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "blob" })).not.toBeInTheDocument();
  });

  it("renders blob chip when hasBlobContext is true", () => {
    render(<ModeChips mode="chat" hasBlobContext={true} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "blob" })).toBeInTheDocument();
  });

  it("marks the active mode chip as active", () => {
    render(<ModeChips mode="notes" hasBlobContext={false} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "notes" })).toHaveClass("chatbot-mode-chip--active");
  });

  it("calls onChange with the clicked mode", async () => {
    const onChange = vi.fn();
    render(<ModeChips mode="chat" hasBlobContext={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "notes" }));
    expect(onChange).toHaveBeenCalledWith("notes");
  });

  it("renders a non-clickable indicator chip for question mode", () => {
    render(<ModeChips mode="question" hasBlobContext={false} onChange={vi.fn()} />);
    const chip = screen.getByText("question");
    expect(chip.tagName).toBe("SPAN");
  });

  it("renders a non-clickable indicator chip for exercise mode", () => {
    render(<ModeChips mode="exercise" hasBlobContext={false} onChange={vi.fn()} />);
    const chip = screen.getByText("exercise");
    expect(chip.tagName).toBe("SPAN");
  });
});
