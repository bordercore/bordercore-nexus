import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Replace SelectValue with a minimal stand-in so we don't hit its real
// axios-driven search behavior. The stub exposes a button that fires onSelect
// with a canned node — enough to drive the modal's own branching logic.
vi.mock("../common/SelectValue", () => ({
  SelectValue: ({ onSelect }: { onSelect: (v: { uuid: string; name: string }) => void }) => (
    <button
      type="button"
      data-testid="select-value"
      onClick={() => onSelect({ uuid: "picked-uuid", name: "picked" })}
    >
      pick node
    </button>
  ),
}));

import NodeNodeModal from "./NodeNodeModal";

function baseProps(overrides: Partial<React.ComponentProps<typeof NodeNodeModal>> = {}) {
  return {
    isOpen: true,
    action: "Add" as const,
    searchUrl: "/api/node/search/",
    data: { rotate: -1 },
    onSave: vi.fn(),
    onSelectNode: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("NodeNodeModal", () => {
  it("shows the SelectValue picker only in Add mode", () => {
    const { rerender } = render(<NodeNodeModal {...baseProps({ action: "Add" })} />);
    expect(screen.getByTestId("select-value")).toBeInTheDocument();

    rerender(<NodeNodeModal {...baseProps({ action: "Edit" })} />);
    expect(screen.queryByTestId("select-value")).not.toBeInTheDocument();
  });

  it("does not call onSelectNode when Save is clicked without a selection", async () => {
    const user = userEvent.setup();
    const onSelectNode = vi.fn();
    render(<NodeNodeModal {...baseProps({ onSelectNode })} />);
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSelectNode).not.toHaveBeenCalled();
  });

  it("calls onSelectNode with the picked uuid and current options on Add", async () => {
    const user = userEvent.setup();
    const onSelectNode = vi.fn();
    render(<NodeNodeModal {...baseProps({ onSelectNode })} />);
    await user.click(screen.getByTestId("select-value"));
    await user.selectOptions(screen.getByLabelText(/rotate/i), "10");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSelectNode).toHaveBeenCalledWith("picked-uuid", { rotate: 10 });
  });

  it("calls onSave on Edit mode with the current options", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<NodeNodeModal {...baseProps({ action: "Edit", data: { rotate: 5 }, onSave })} />);
    await user.selectOptions(screen.getByLabelText(/rotate/i), "60");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith({ rotate: 60 });
  });

  it("renders nothing when isOpen is false and renders the dialog when true", () => {
    const { rerender } = render(<NodeNodeModal {...baseProps({ isOpen: false })} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<NodeNodeModal {...baseProps({ isOpen: true })} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NodeNodeModal {...baseProps({ onClose })} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
