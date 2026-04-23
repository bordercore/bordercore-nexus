import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import EditNodeModal from "./EditNodeModal";

function baseProps(overrides: Partial<React.ComponentProps<typeof EditNodeModal>> = {}) {
  return {
    open: true,
    initialName: "original",
    initialNote: "original note",
    onClose: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
}

describe("EditNodeModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<EditNodeModal {...baseProps({ open: false })} />);
    expect(container.textContent).toBe("");
  });

  it("initializes the form inputs from props when opened", () => {
    render(<EditNodeModal {...baseProps()} />);
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("original");
    expect(screen.getByLabelText(/^note/i)).toHaveValue("original note");
  });

  it("enables save only when the name is non-empty (after trim)", async () => {
    const user = userEvent.setup();
    render(<EditNodeModal {...baseProps()} />);
    const save = screen.getByRole("button", { name: /save changes/i });
    expect(save).toBeEnabled();

    const input = screen.getByLabelText(/^name$/i);
    await user.clear(input);
    expect(save).toBeDisabled();

    await user.type(input, "   ");
    expect(save).toBeDisabled();

    await user.type(input, "new");
    expect(save).toBeEnabled();
  });

  it("submits trimmed name and current note via onSave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EditNodeModal {...baseProps({ onSave })} />);
    const input = screen.getByLabelText(/^name$/i);
    await user.clear(input);
    await user.type(input, "  renamed  ");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSave).toHaveBeenCalledWith("renamed", "original note");
  });

  it("submits on Enter in the name input", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EditNodeModal {...baseProps({ onSave })} />);
    const input = screen.getByLabelText(/^name$/i);
    await user.click(input);
    await user.keyboard("{Enter}");
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and via Cancel/close buttons", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<EditNodeModal {...baseProps({ onClose })} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
