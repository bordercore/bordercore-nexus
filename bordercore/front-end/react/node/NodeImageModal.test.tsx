import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const show = vi.fn();
const hide = vi.fn();

vi.mock("bootstrap", () => ({
  // Needs to be a real class so `new Modal(...)` works in the component.
  Modal: class {
    show = show;
    hide = hide;
  },
}));

import NodeImageModal from "./NodeImageModal";

function reset() {
  show.mockReset();
  hide.mockReset();
}

describe("NodeImageModal", () => {
  it("renders an image pointing at imageUrl", () => {
    reset();
    // Portaled to <body>, so look at baseElement rather than container.
    const { baseElement } = render(
      <NodeImageModal isOpen={false} imageUrl="/pic.jpg" onClose={vi.fn()} />
    );
    const img = baseElement.querySelector("#node-image-modal img");
    expect(img?.getAttribute("src")).toBe("/pic.jpg");
  });

  it("calls Modal.show() when opened", () => {
    reset();
    const { rerender } = render(
      <NodeImageModal isOpen={false} imageUrl="/pic.jpg" onClose={vi.fn()} />
    );
    expect(show).not.toHaveBeenCalled();
    rerender(<NodeImageModal isOpen imageUrl="/pic.jpg" onClose={vi.fn()} />);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("calls Modal.hide() when closed after being open", () => {
    reset();
    const { rerender } = render(<NodeImageModal isOpen imageUrl="/pic.jpg" onClose={vi.fn()} />);
    expect(show).toHaveBeenCalledTimes(1);
    rerender(<NodeImageModal isOpen={false} imageUrl="/pic.jpg" onClose={vi.fn()} />);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when Bootstrap emits hidden.bs.modal", () => {
    reset();
    const onClose = vi.fn();
    const { baseElement } = render(<NodeImageModal isOpen imageUrl="/pic.jpg" onClose={onClose} />);
    const dialog = baseElement.querySelector("#node-image-modal")!;
    dialog.dispatchEvent(new Event("hidden.bs.modal"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
