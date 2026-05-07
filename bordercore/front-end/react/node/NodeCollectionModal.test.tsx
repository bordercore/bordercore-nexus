import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../common/SelectValue", () => ({
  SelectValue: ({ onSelect }: { onSelect: (v: { uuid: string; name: string }) => void }) => (
    <button
      type="button"
      data-testid="select-value"
      onClick={() => onSelect({ uuid: "existing-uuid", name: "existing" })}
    >
      pick collection
    </button>
  ),
}));

import NodeCollectionModal, { CollectionSettings } from "./NodeCollectionModal";

function defaultSettings(overrides: Partial<CollectionSettings> = {}): CollectionSettings {
  return {
    name: "New Collection",
    collection_type: "ad-hoc",
    display: "list",
    rotate: -1,
    random_order: false,
    limit: null,
    ...overrides,
  };
}

function baseProps(overrides: Partial<React.ComponentProps<typeof NodeCollectionModal>> = {}) {
  return {
    isOpen: true,
    action: "Add" as const,
    searchUrl: "/api/collection/search/",
    data: defaultSettings(),
    onSave: vi.fn(),
    onAddCollection: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

// In Add mode, the "New" / "Existing" type radios are rendered as
// study-method-card labels whose accessible name is "<title> <hint>". The
// helpers below pick them out without depending on the hint text.
function getTypeRadio(type: "new" | "existing"): HTMLInputElement {
  const re = type === "new" ? /^New/ : /^Existing/;
  return screen.getByRole("radio", { name: re }) as HTMLInputElement;
}

function queryTypeRadio(type: "new" | "existing"): HTMLInputElement | null {
  const re = type === "new" ? /^New/ : /^Existing/;
  return screen.queryByRole("radio", { name: re }) as HTMLInputElement | null;
}

describe("NodeCollectionModal", () => {
  it("shows the action label", () => {
    render(<NodeCollectionModal {...baseProps({ action: "Edit" })} />);
    expect(screen.getByText("Edit collection")).toBeInTheDocument();
  });

  it("hides the Type radios when editing", () => {
    render(<NodeCollectionModal {...baseProps({ action: "Edit" })} />);
    expect(queryTypeRadio("new")).not.toBeInTheDocument();
    expect(queryTypeRadio("existing")).not.toBeInTheDocument();
  });

  it("renders the SelectValue picker only when Existing is chosen in Add mode", async () => {
    const user = userEvent.setup();
    render(<NodeCollectionModal {...baseProps({ action: "Add" })} />);
    expect(screen.queryByTestId("select-value")).not.toBeInTheDocument();
    await user.click(getTypeRadio("existing"));
    expect(screen.getByTestId("select-value")).toBeInTheDocument();
  });

  it("hides the Name input when the type is Existing (permanent)", async () => {
    const user = userEvent.setup();
    render(<NodeCollectionModal {...baseProps({ action: "Add" })} />);
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    await user.click(getTypeRadio("existing"));
    expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument();
  });

  it("swaps between Limit (list display) and Rotate (individual display)", async () => {
    const user = userEvent.setup();
    render(<NodeCollectionModal {...baseProps({ action: "Add" })} />);
    // Default: display=list, so Limit is shown and Rotate is hidden.
    expect(screen.getByLabelText(/limit/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^rotate$/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^display$/i), "individual");
    expect(screen.getByLabelText(/^rotate$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/limit/i)).not.toBeInTheDocument();
  });

  it("calls onAddCollection with the ad-hoc payload (no uuid)", async () => {
    const user = userEvent.setup();
    const onAddCollection = vi.fn();
    render(<NodeCollectionModal {...baseProps({ action: "Add", onAddCollection })} />);
    await user.clear(screen.getByLabelText(/^name$/i));
    await user.type(screen.getByLabelText(/^name$/i), "My List");
    await user.click(screen.getByLabelText(/random order/i));
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onAddCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "My List",
        collection_type: "ad-hoc",
        random_order: true,
        uuid: undefined,
      })
    );
  });

  it("passes the picked uuid when adding an Existing collection", async () => {
    const user = userEvent.setup();
    const onAddCollection = vi.fn();
    render(<NodeCollectionModal {...baseProps({ action: "Add", onAddCollection })} />);
    await user.click(getTypeRadio("existing"));
    await user.click(screen.getByTestId("select-value"));
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onAddCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        collection_type: "permanent",
        uuid: "existing-uuid",
      })
    );
  });

  it("calls onSave in Edit mode (no onAddCollection)", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onAddCollection = vi.fn();
    render(
      <NodeCollectionModal
        {...baseProps({
          action: "Edit",
          data: defaultSettings({
            uuid: "existing-uuid",
            collection_type: "permanent",
            display: "individual",
            rotate: 5,
          }),
          onSave,
          onAddCollection,
        })}
      />
    );
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        collection_type: "permanent",
        display: "individual",
        rotate: 5,
        uuid: "existing-uuid",
      })
    );
    expect(onAddCollection).not.toHaveBeenCalled();
  });
});
