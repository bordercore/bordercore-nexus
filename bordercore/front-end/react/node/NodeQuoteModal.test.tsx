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

import NodeQuoteModal from "./NodeQuoteModal";
import type { QuoteOptions } from "./types";

function baseOptions(): QuoteOptions {
  return { color: 1, rotate: -1, format: "standard", favorites_only: false };
}

function baseProps(overrides: Partial<React.ComponentProps<typeof NodeQuoteModal>> = {}) {
  return {
    isOpen: true,
    action: "Add" as const,
    nodeUuid: "node-uuid",
    addQuoteUrl: "/api/quote/add/",
    data: baseOptions(),
    onSave: vi.fn(),
    onAddQuote: vi.fn(),
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

describe("NodeQuoteModal", () => {
  it("shows the action label in the title", () => {
    render(<NodeQuoteModal {...baseProps({ action: "Edit" })} />);
    expect(screen.getByText("Edit Quote")).toBeInTheDocument();
  });

  it("initializes rotate, format, and favorites_only from the data prop", () => {
    render(
      <NodeQuoteModal
        {...baseProps({
          data: { color: 2, rotate: 10, format: "minimal", favorites_only: true },
        })}
      />
    );
    expect(screen.getByLabelText(/rotate/i)).toHaveValue("10");
    expect(screen.getByLabelText(/format/i)).toHaveValue("minimal");
    expect(screen.getByLabelText(/favorites only/i)).toBeChecked();
  });

  it("routes Save to onAddQuote on Add and onSave on Edit", async () => {
    const user = userEvent.setup();
    const onAddQuote = vi.fn();
    const onSave = vi.fn();

    const { rerender } = render(
      <NodeQuoteModal {...baseProps({ action: "Add", onAddQuote, onSave })} />
    );
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onAddQuote).toHaveBeenCalledWith(baseOptions());
    expect(onSave).not.toHaveBeenCalled();

    rerender(<NodeQuoteModal {...baseProps({ action: "Edit", onAddQuote, onSave })} />);
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(baseOptions());
  });

  it("saves with the updated color when a swatch is clicked", async () => {
    const user = userEvent.setup();
    const onAddQuote = vi.fn();
    render(<NodeQuoteModal {...baseProps({ onAddQuote })} />);
    await user.click(swatches().find(el => el.className.includes("node-color-4"))!);
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onAddQuote).toHaveBeenCalledWith(expect.objectContaining({ color: 4 }));
  });

  it("saves with the updated rotate, format, and favorites_only state", async () => {
    const user = userEvent.setup();
    const onAddQuote = vi.fn();
    render(<NodeQuoteModal {...baseProps({ onAddQuote })} />);
    await user.selectOptions(screen.getByLabelText(/rotate/i), "30");
    await user.selectOptions(screen.getByLabelText(/format/i), "minimal");
    await user.click(screen.getByLabelText(/favorites only/i));
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onAddQuote).toHaveBeenCalledWith({
      color: 1,
      rotate: 30,
      format: "minimal",
      favorites_only: true,
    });
  });
});
