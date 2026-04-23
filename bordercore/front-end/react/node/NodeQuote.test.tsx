import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../utils/reactUtils", () => ({
  doGet: vi.fn(),
  doPost: vi.fn(),
  doPut: vi.fn(),
  EventBus: { $on: vi.fn(), $once: vi.fn(), $off: vi.fn(), $emit: vi.fn() },
}));

import { doGet, doPost } from "../utils/reactUtils";
import NodeQuote from "./NodeQuote";
import type { QuoteOptions } from "./types";

const baseOptions: QuoteOptions = {
  color: 3,
  rotate: -1,
  format: "standard",
  favorites_only: false,
};

const baseProps = {
  uuid: "quote-uuid",
  nodeUuid: "node-uuid",
  quoteOptionsInitial: baseOptions,
  getQuoteUrl: "/api/quote/quote-uuid/",
  getAndSetQuoteUrl: "/api/quote/random/",
  removeComponentUrl: "/node/remove/",
  editQuoteUrl: "/api/quote/update/",
  onOpenQuoteEditModal: vi.fn(),
  onEditLayout: vi.fn(),
};

function renderQuote(options: Partial<QuoteOptions> = {}) {
  (doGet as Mock).mockImplementation((_url, cb) => {
    cb({
      data: { uuid: "q1", quote: "To be or not to be", source: "Shakespeare", is_favorite: false },
    });
  });
  return render(<NodeQuote {...baseProps} quoteOptionsInitial={{ ...baseOptions, ...options }} />);
}

beforeEach(() => {
  (doGet as Mock).mockReset();
  (doPost as Mock).mockReset();
});

describe("NodeQuote", () => {
  it("fetches the quote on mount from getQuoteUrl", () => {
    renderQuote();
    expect(doGet).toHaveBeenCalled();
    expect((doGet as Mock).mock.calls[0][0]).toBe("/api/quote/quote-uuid/");
  });

  it("renders the quote text and source", () => {
    renderQuote();
    expect(screen.getByText(/to be or not to be/i)).toBeInTheDocument();
    expect(screen.getByText("Shakespeare")).toBeInTheDocument();
  });

  it("applies the card color class from options", () => {
    const { container } = renderQuote({ color: 4 });
    expect(container.querySelector(".card")?.className).toMatch(/node-color-4/);
  });

  it("hides the title slot in minimal format", () => {
    renderQuote({ format: "minimal" });
    expect(screen.queryByText(/^quote$/i)).not.toBeInTheDocument();
  });

  it("shows the title slot in standard format", () => {
    renderQuote({ format: "standard" });
    expect(screen.getByText(/^quote$/i)).toBeInTheDocument();
  });

  it("posts to removeComponentUrl when Remove quote is clicked", async () => {
    const onEditLayout = vi.fn();
    const user = userEvent.setup();
    (doGet as Mock).mockImplementation((_url, cb) => {
      cb({ data: { uuid: "q", quote: "x", source: "y", is_favorite: false } });
    });
    const { container } = render(<NodeQuote {...baseProps} onEditLayout={onEditLayout} />);
    await user.click(container.querySelector(".dropdown-trigger")!);
    await user.click(await screen.findByText(/remove quote/i));

    const [url, payload, callback] = (doPost as Mock).mock.calls[0];
    expect(url).toBe("/node/remove/");
    expect(payload).toEqual({ node_uuid: "node-uuid", uuid: "quote-uuid" });
    callback({ data: { layout: "[[],[],[]]" } });
    expect(onEditLayout).toHaveBeenCalledWith("[[],[],[]]");
  });

  it("ignores keyboard shortcuts unless the card is hovered", () => {
    renderQuote();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(doPost).not.toHaveBeenCalled();
  });

  it("requests a new random quote on ArrowRight when hovered", () => {
    const { container } = renderQuote();
    fireEvent.mouseOver(container.querySelector(".hover-target")!);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(doPost).toHaveBeenCalledWith(
      "/api/quote/random/",
      { node_uuid: "node-uuid", favorites_only: "false" },
      expect.any(Function)
    );
  });

  it("opens the edit modal on the 'u' shortcut when hovered", () => {
    const onOpenQuoteEditModal = vi.fn();
    (doGet as Mock).mockImplementation((_url, cb) => {
      cb({ data: { uuid: "q", quote: "x", source: "y", is_favorite: false } });
    });
    const { container } = render(
      <NodeQuote {...baseProps} onOpenQuoteEditModal={onOpenQuoteEditModal} />
    );
    fireEvent.mouseOver(container.querySelector(".hover-target")!);
    fireEvent.keyDown(document, { key: "u" });
    expect(onOpenQuoteEditModal).toHaveBeenCalledWith(expect.any(Function), baseOptions);
  });

  it("stops reacting to keys after mouse leaves the card", () => {
    const { container } = renderQuote();
    fireEvent.mouseOver(container.querySelector(".hover-target")!);
    fireEvent.mouseLeave(container.querySelector(".hover-target")!);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(doPost).not.toHaveBeenCalled();
  });
});
