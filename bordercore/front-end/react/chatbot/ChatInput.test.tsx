import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "./ChatInput";

const baseProps = {
  value: "",
  onChange: vi.fn(),
  onSend: vi.fn(),
  onStop: vi.fn(),
  onEscape: vi.fn(),
  isStreaming: false,
};

describe("ChatInput", () => {
  it("renders the textarea with placeholder", () => {
    render(<ChatInput {...baseProps} />);
    const textarea = screen.getByPlaceholderText(/ask anything/i);
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("calls onChange when typing", async () => {
    const onChange = vi.fn();
    render(<ChatInput {...baseProps} onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox"), "hi");
    expect(onChange).toHaveBeenCalled();
  });

  it("calls onSend when Enter is pressed", async () => {
    const onSend = vi.fn();
    render(<ChatInput {...baseProps} value="hello" onSend={onSend} />);
    const textarea = screen.getByRole("textbox");
    textarea.focus();
    await userEvent.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onSend when Shift+Enter is pressed", async () => {
    const onSend = vi.fn();
    render(<ChatInput {...baseProps} value="hello" onSend={onSend} />);
    const textarea = screen.getByRole("textbox");
    textarea.focus();
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("calls onEscape when Escape is pressed", async () => {
    const onEscape = vi.fn();
    render(<ChatInput {...baseProps} onEscape={onEscape} />);
    const textarea = screen.getByRole("textbox");
    textarea.focus();
    await userEvent.keyboard("{Escape}");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("shows the stop button when isStreaming is true", () => {
    render(<ChatInput {...baseProps} isStreaming={true} />);
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });

  it("does not show the stop button when isStreaming is false", () => {
    render(<ChatInput {...baseProps} isStreaming={false} />);
    expect(screen.queryByRole("button", { name: /stop/i })).not.toBeInTheDocument();
  });

  it("calls onStop when stop button is clicked", async () => {
    const onStop = vi.fn();
    render(<ChatInput {...baseProps} isStreaming={true} onStop={onStop} />);
    await userEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
