import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import NodeNoteModal from "./NodeNoteModal";
import type { NodeColor } from "./types";

function baseProps(overrides: Partial<React.ComponentProps<typeof NodeNoteModal>> = {}) {
  return {
    open: true,
    action: "Add" as const,
    data: { name: "Inbox", color: 2 as NodeColor },
    onSave: vi.fn(),
    onColorChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

function swatches(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".refined-modal .node-color"));
}

describe("NodeNoteModal", () => {
  it("shows the action label in the title", () => {
    render(<NodeNoteModal {...baseProps({ action: "Edit" })} />);
    expect(screen.getByText("Edit note")).toBeInTheDocument();
  });

  it("uses the Add title when action is Add", () => {
    render(<NodeNoteModal {...baseProps({ action: "Add" })} />);
    expect(screen.getByText("Add a note")).toBeInTheDocument();
  });

  it("initializes the name input and selected color from props", () => {
    render(<NodeNoteModal {...baseProps({ data: { name: "Notes", color: 3 } })} />);
    expect(screen.getByLabelText(/name/i)).toHaveValue("Notes");
    const selected = swatches().filter(el => el.className.includes("selected-color"));
    expect(selected).toHaveLength(1);
    expect(selected[0].className).toMatch(/node-color-3\b/);
  });

  it("changes selected color on swatch click and invokes onColorChange", async () => {
    const user = userEvent.setup();
    const onColorChange = vi.fn();
    render(<NodeNoteModal {...baseProps({ data: { name: "n", color: 1 }, onColorChange })} />);
    const four = swatches().find(el => el.className.includes("node-color-4"))!;
    await user.click(four);
    expect(onColorChange).toHaveBeenCalledWith(4);
    expect(four.className).toMatch(/selected-color/);
  });

  it("submits onSave with current name and color when Save is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<NodeNoteModal {...baseProps({ onSave, data: { name: "seed", color: 1 } })} />);
    const input = screen.getByLabelText(/name/i);
    await user.clear(input);
    await user.type(input, "Project X");
    await user.click(swatches().find(el => el.className.includes("node-color-3"))!);
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith({ name: "Project X", color: 3 });
  });

  it("submits on Enter in the name input", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<NodeNoteModal {...baseProps({ onSave })} />);
    await user.click(screen.getByLabelText(/name/i));
    await user.keyboard("{Enter}");
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when open is false", () => {
    const { container, baseElement } = render(<NodeNoteModal {...baseProps({ open: false })} />);
    expect(container).toBeEmptyDOMElement();
    expect(baseElement.querySelector(".refined-modal")).toBeNull();
  });

  it("calls onClose when the cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NodeNoteModal {...baseProps({ onClose })} />);
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NodeNoteModal {...baseProps({ onClose })} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the scrim is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { baseElement } = render(<NodeNoteModal {...baseProps({ onClose })} />);
    const scrim = baseElement.querySelector(".refined-modal-scrim") as HTMLElement;
    await user.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
