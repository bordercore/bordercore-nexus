import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const show = vi.fn();
const hide = vi.fn();

vi.mock("bootstrap", () => ({
  Modal: class {
    show = show;
    hide = hide;
  },
}));

import NodeNoteModal from "./NodeNoteModal";
import type { NodeColor } from "./types";

function baseProps(overrides: Partial<React.ComponentProps<typeof NodeNoteModal>> = {}) {
  return {
    isOpen: true,
    action: "Add" as const,
    data: { name: "Inbox", color: 2 as NodeColor },
    onSave: vi.fn(),
    onColorChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

function swatches(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".modal-body .node-color"));
}

beforeEach(() => {
  show.mockReset();
  hide.mockReset();
});

describe("NodeNoteModal", () => {
  it("shows the action label in the title", () => {
    render(<NodeNoteModal {...baseProps({ action: "Edit" })} />);
    expect(screen.getByText("Edit Note")).toBeInTheDocument();
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
    render(<NodeNoteModal {...baseProps({ onSave, data: { name: "", color: 1 } })} />);
    const input = screen.getByLabelText(/name/i);
    await user.type(input, "Project X");
    await user.click(swatches().find(el => el.className.includes("node-color-3"))!);
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith({ name: "Project X", color: 3 });
    expect(hide).toHaveBeenCalled();
  });

  it("submits on Enter in the name input", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<NodeNoteModal {...baseProps({ onSave })} />);
    await user.click(screen.getByLabelText(/name/i));
    await user.keyboard("{Enter}");
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("opens the Bootstrap modal when isOpen toggles true", () => {
    const { rerender } = render(<NodeNoteModal {...baseProps({ isOpen: false })} />);
    expect(show).not.toHaveBeenCalled();
    rerender(<NodeNoteModal {...baseProps({ isOpen: true })} />);
    expect(show).toHaveBeenCalled();
  });

  it("forwards Bootstrap's hidden.bs.modal event to onClose", () => {
    const onClose = vi.fn();
    const { baseElement } = render(<NodeNoteModal {...baseProps({ onClose })} />);
    baseElement.querySelector("#modalEditNote")!.dispatchEvent(new Event("hidden.bs.modal"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
