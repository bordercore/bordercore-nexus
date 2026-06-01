import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const doGet = vi.fn();
const doPost = vi.fn();

vi.mock("../../utils/reactUtils", () => ({
  doGet: (...args: unknown[]) => doGet(...args),
  doPost: (...args: unknown[]) => doPost(...args),
  EventBus: { $emit: vi.fn() },
}));

// ObjectSelectModal is exercised in its own context; here we only need to know
// it mounts when open and can hand back a selection.
vi.mock("../ObjectSelectModal", () => ({
  __esModule: true,
  default: ({ open, onSelectObject }: any) =>
    open ? (
      <div data-testid="object-select-modal">
        <button onClick={() => onSelectObject({ uuid: "new-1", name: "Picked" })}>pick</button>
      </div>
    ) : null,
  ObjectSelectModal: () => null,
}));

import { RelatedObjects, RelatedObjectsHandle } from "./RelatedObjects";
import type { RelatedObject } from "./types";

const items: RelatedObject[] = [
  { uuid: "o1", name: "First Object", url: "/blob/o1", type: "blob" },
];

const urls = {
  relatedObjects: "/api/related/node/",
  add: "/api/related/add",
  remove: "/api/related/remove",
  sort: "/api/related/sort",
  editNote: "/api/related/note",
  searchNames: "/api/search/names",
};

beforeEach(() => {
  doGet.mockReset();
  doPost.mockReset();
  doGet.mockImplementation((_url: string, cb: (r: unknown) => void) =>
    cb({ data: { related_objects: items } })
  );
});

describe("RelatedObjects (wrapper)", () => {
  it("renders the fetched items and exposes the count to the header", async () => {
    render(
      <RelatedObjects
        objectUuid="node"
        nodeType="drill"
        urls={urls}
        header={({ count }) => <h3>Related {count}</h3>}
      />
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "First Object" })).toBeInTheDocument()
    );
    expect(screen.getByText("Related 1")).toBeInTheDocument();
  });

  it("opens the add modal from the header trigger and adds the chosen object", async () => {
    const user = userEvent.setup();
    doPost.mockImplementation((_url, _params, onSuccess) => onSuccess({ data: {} }));
    render(
      <RelatedObjects
        objectUuid="node"
        nodeType="drill"
        urls={urls}
        header={({ openAddModal }) => (
          <button onClick={openAddModal} aria-label="Add related object" />
        )}
      />
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "First Object" })).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: "Add related object" }));
    expect(screen.getByTestId("object-select-modal")).toBeInTheDocument();

    await user.click(screen.getByText("pick"));
    const addCall = doPost.mock.calls.find(c => c[0] === urls.add);
    expect(addCall?.[1]).toMatchObject({
      node_uuid: "node",
      object_uuid: "new-1",
      node_type: "drill",
    });
  });

  it("supports a className computed from the item count", async () => {
    const { container } = render(
      <RelatedObjects
        objectUuid="node"
        nodeType="blob"
        urls={urls}
        className={count => `bd-rail-section${count === 0 ? " is-empty" : ""}`}
        header={() => <h3>Related</h3>}
      />
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "First Object" })).toBeInTheDocument()
    );
    // one item -> not empty
    expect(container.querySelector(".bd-rail-section")).not.toHaveClass("is-empty");
  });

  it("exposes openAddModal via ref for external triggers (e.g. a topbar button)", async () => {
    const ref = React.createRef<RelatedObjectsHandle>();
    render(
      <RelatedObjects
        ref={ref}
        objectUuid="node"
        nodeType="drill"
        urls={urls}
        header={() => <h3>Related</h3>}
      />
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "First Object" })).toBeInTheDocument()
    );
    expect(screen.queryByTestId("object-select-modal")).not.toBeInTheDocument();

    act(() => ref.current?.openAddModal());
    expect(screen.getByTestId("object-select-modal")).toBeInTheDocument();
  });
});
