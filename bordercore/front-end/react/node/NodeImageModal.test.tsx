import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import NodeImageModal from "./NodeImageModal";

describe("NodeImageModal", () => {
  it("renders nothing when isOpen is false", () => {
    const { baseElement } = render(
      <NodeImageModal isOpen={false} imageUrl="/pic.jpg" onClose={vi.fn()} />
    );
    expect(baseElement.querySelector(".refined-modal--viewer")).toBeNull();
  });

  it("renders an image pointing at imageUrl when open", () => {
    // Portaled to <body>, so look at baseElement rather than container.
    const { baseElement } = render(<NodeImageModal isOpen imageUrl="/pic.jpg" onClose={vi.fn()} />);
    const img = baseElement.querySelector(".refined-modal--viewer img");
    expect(img?.getAttribute("src")).toBe("/pic.jpg");
  });

  it("invokes onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    const { baseElement } = render(<NodeImageModal isOpen imageUrl="/pic.jpg" onClose={onClose} />);
    const closeBtn = baseElement.querySelector(".refined-modal-close") as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when the scrim is clicked", () => {
    const onClose = vi.fn();
    const { baseElement } = render(<NodeImageModal isOpen imageUrl="/pic.jpg" onClose={onClose} />);
    const scrim = baseElement.querySelector(".refined-modal-scrim--viewer") as HTMLDivElement;
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<NodeImageModal isOpen imageUrl="/pic.jpg" onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not listen for Escape when closed", () => {
    const onClose = vi.fn();
    render(<NodeImageModal isOpen={false} imageUrl="/pic.jpg" onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
