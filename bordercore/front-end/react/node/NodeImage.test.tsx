import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../utils/reactUtils", () => ({
  doGet: vi.fn(),
  doPost: vi.fn(),
  doPut: vi.fn(),
  EventBus: { $on: vi.fn(), $once: vi.fn(), $off: vi.fn(), $emit: vi.fn() },
}));

import { doPost } from "../utils/reactUtils";
import NodeImage from "./NodeImage";

const baseProps = {
  uuid: "img-uuid",
  nodeUuid: "node-uuid",
  imageTitle: "sunset",
  imageUrl: "/media/image.jpg",
  imageDetailUrl: "/blob/img-uuid/",
  removeComponentUrl: "/node/remove/",
};

beforeEach(() => {
  (doPost as Mock).mockReset();
});

describe("NodeImage", () => {
  it("renders the image with the provided src, alt, and title", () => {
    const { container } = render(
      <NodeImage {...baseProps} onOpenImageModal={vi.fn()} onEditLayout={vi.fn()} />
    );
    const img = container.querySelector<HTMLImageElement>("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/media/image.jpg");
    expect(img?.getAttribute("alt")).toBe("sunset");
    expect(screen.getByText("sunset")).toBeInTheDocument();
  });

  it("calls onOpenImageModal with the image url when the image is clicked", async () => {
    const onOpenImageModal = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <NodeImage {...baseProps} onOpenImageModal={onOpenImageModal} onEditLayout={vi.fn()} />
    );
    await user.click(container.querySelector("img")!);
    expect(onOpenImageModal).toHaveBeenCalledWith("/media/image.jpg");
  });

  it("points the Media detail link at imageDetailUrl with a safe target", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <NodeImage {...baseProps} onOpenImageModal={vi.fn()} onEditLayout={vi.fn()} />
    );
    // Open the dropdown menu so its items are rendered (the trigger is a div, not a button).
    await user.click(container.querySelector(".dropdown-trigger")!);
    const detail = await screen.findByRole("link", { name: /media detail/i });
    expect(detail).toHaveAttribute("href", "/blob/img-uuid/");
    expect(detail).toHaveAttribute("target", "_blank");
    expect(detail).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("posts to removeComponentUrl and forwards the new layout when Remove is clicked", async () => {
    const onEditLayout = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <NodeImage {...baseProps} onOpenImageModal={vi.fn()} onEditLayout={onEditLayout} />
    );
    await user.click(container.querySelector(".dropdown-trigger")!);
    await user.click(await screen.findByText(/remove media/i));

    expect(doPost).toHaveBeenCalledTimes(1);
    const [url, payload, callback] = (doPost as Mock).mock.calls[0];
    expect(url).toBe("/node/remove/");
    expect(payload).toEqual({ node_uuid: "node-uuid", uuid: "img-uuid" });

    // Simulate the server response and ensure onEditLayout gets the new layout.
    callback({ data: { layout: "[[],[],[]]" } });
    expect(onEditLayout).toHaveBeenCalledWith("[[],[],[]]");
  });
});
