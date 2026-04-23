import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../utils/reactUtils", () => ({
  doGet: vi.fn(),
  doPost: vi.fn(),
  doPut: vi.fn(),
  EventBus: { $on: vi.fn(), $once: vi.fn(), $off: vi.fn(), $emit: vi.fn() },
}));

import { doGet, doPost } from "../utils/reactUtils";
import NodeNode from "./NodeNode";
import type { NodeInfo } from "./types";

const baseProps = {
  uuid: "nn-uuid",
  parentNodeUuid: "parent-uuid",
  nodeOptionsInitial: { rotate: -1 },
  getNodeInfoUrl: "/api/node/preview/",
  nodeDetailUrl: "/node/child-uuid/",
  removeComponentUrl: "/node/remove/",
  editNodeUrl: "/node/update/",
  onOpenNodeModal: vi.fn(),
  onEditLayout: vi.fn(),
};

function renderWithInfo(info: Partial<NodeInfo> = {}) {
  const full: NodeInfo = {
    uuid: "child-uuid",
    name: "child-node",
    images: [],
    note_count: 0,
    todo_count: 0,
    random_note: null,
    random_todo: null,
    ...info,
  };
  (doGet as Mock).mockImplementation((_url, cb) => {
    cb({ data: { info: full } });
  });
  return render(<NodeNode {...baseProps} />);
}

beforeEach(() => {
  (doGet as Mock).mockReset();
  (doPost as Mock).mockReset();
});

describe("NodeNode", () => {
  it("fetches the preview on mount with notesOnly=false", () => {
    renderWithInfo();
    expect(doGet).toHaveBeenCalled();
    expect((doGet as Mock).mock.calls[0][0]).toBe("/api/node/preview/?notesOnly=false");
  });

  it("renders the node name as a link to the detail page", () => {
    renderWithInfo({ name: "child-node" });
    const link = screen.getByRole("link", { name: "child-node" });
    expect(link).toHaveAttribute("href", "/node/child-uuid/");
  });

  it("renders preview images with cover_url and links them to blob_url", () => {
    const { container } = renderWithInfo({
      images: [
        { uuid: "i1", cover_url: "/thumb/1.jpg", blob_url: "/blob/1/" },
        { uuid: "i2", cover_url: "/thumb/2.jpg", blob_url: "/blob/2/" },
      ],
    });
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(2);
    expect(imgs[0].getAttribute("src")).toBe("/thumb/1.jpg");
    expect(container.querySelector('a[href="/blob/2/"]')).not.toBeNull();
  });

  it("pluralizes notes and todos correctly", () => {
    renderWithInfo({ note_count: 1, todo_count: 3 });
    // Match against adjacent text inside the metadata block.
    expect(screen.getByText(/note$/)).toBeInTheDocument();
    expect(screen.getByText(/todos$/)).toBeInTheDocument();
  });

  it("hides the note/todo block when counts are zero", () => {
    renderWithInfo({ note_count: 0, todo_count: 0 });
    expect(screen.queryByText(/note$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/todo$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/todos$/)).not.toBeInTheDocument();
  });

  it("shows the random note name when provided", () => {
    renderWithInfo({ note_count: 2, random_note: { name: "pick-me" } });
    expect(screen.getByText("pick-me")).toBeInTheDocument();
  });

  it("posts to removeComponentUrl when Remove Node is clicked", async () => {
    const onEditLayout = vi.fn();
    const user = userEvent.setup();
    (doGet as Mock).mockImplementation((_url, cb) => {
      cb({
        data: {
          info: {
            uuid: "c",
            name: "c",
            images: [],
            note_count: 0,
            todo_count: 0,
            random_note: null,
            random_todo: null,
          },
        },
      });
    });
    const { container } = render(<NodeNode {...baseProps} onEditLayout={onEditLayout} />);
    await user.click(container.querySelector(".dropdown-trigger")!);
    await user.click(await screen.findByText(/remove node/i));

    const [url, payload, callback] = (doPost as Mock).mock.calls[0];
    expect(url).toBe("/node/remove/");
    expect(payload).toEqual({ node_uuid: "parent-uuid", uuid: "nn-uuid" });
    callback({ data: { layout: "[[],[],[]]" } });
    expect(onEditLayout).toHaveBeenCalledWith("[[],[],[]]");
  });

  it("opens the edit modal with current options when Edit Node is clicked", async () => {
    const onOpenNodeModal = vi.fn();
    const user = userEvent.setup();
    (doGet as Mock).mockImplementation((_url, cb) => {
      cb({
        data: {
          info: {
            uuid: "c",
            name: "c",
            images: [],
            note_count: 0,
            todo_count: 0,
            random_note: null,
            random_todo: null,
          },
        },
      });
    });
    const { container } = render(
      <NodeNode
        {...baseProps}
        nodeOptionsInitial={{ rotate: 5 }}
        onOpenNodeModal={onOpenNodeModal}
      />
    );
    await user.click(container.querySelector(".dropdown-trigger")!);
    await user.click(await screen.findByText(/edit node/i));
    expect(onOpenNodeModal).toHaveBeenCalledWith(expect.any(Function), { rotate: 5 });
  });
});
