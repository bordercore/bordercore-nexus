import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageActions } from "./MessageActions";

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("MessageActions", () => {
  it("renders only copy for user messages", () => {
    render(
      <MessageActions role="user" content="hi" canRegenerate={false} onRegenerate={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /regenerate/i })).not.toBeInTheDocument();
  });

  it("renders copy and regenerate for assistant messages when canRegenerate is true", () => {
    render(
      <MessageActions role="assistant" content="hi" canRegenerate={true} onRegenerate={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
  });

  it("hides regenerate when canRegenerate is false", () => {
    render(
      <MessageActions role="assistant" content="hi" canRegenerate={false} onRegenerate={vi.fn()} />
    );
    expect(screen.queryByRole("button", { name: /regenerate/i })).not.toBeInTheDocument();
  });

  it("copies content to clipboard and shows confirmation", async () => {
    render(
      <MessageActions
        role="assistant"
        content="copied!"
        canRegenerate={true}
        onRegenerate={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /copy/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("copied!");
    expect(screen.getByText(/copied/i)).toBeInTheDocument();
  });

  it("calls onRegenerate when regenerate is clicked", async () => {
    const onRegenerate = vi.fn();
    render(
      <MessageActions
        role="assistant"
        content="x"
        canRegenerate={true}
        onRegenerate={onRegenerate}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /regenerate/i }));
    expect(onRegenerate).toHaveBeenCalled();
  });
});
