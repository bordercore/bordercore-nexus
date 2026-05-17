import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SaveBar } from "./SaveBar";

function renderBar(overrides: Partial<React.ComponentProps<typeof SaveBar>> = {}) {
  const props: React.ComponentProps<typeof SaveBar> = {
    visible: true,
    dirty: true,
    changedCount: 1,
    saving: false,
    justSaved: false,
    onSave: vi.fn(),
    onDiscard: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<SaveBar {...props} />) };
}

describe("SaveBar", () => {
  it("adds the 'visible' class only when visible is true", () => {
    const { container, rerender } = render(
      <SaveBar
        visible={true}
        dirty={true}
        changedCount={1}
        saving={false}
        justSaved={false}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
      />
    );
    const bar = container.querySelector(".prefs-savebar");
    expect(bar?.classList.contains("visible")).toBe(true);

    rerender(
      <SaveBar
        visible={false}
        dirty={true}
        changedCount={1}
        saving={false}
        justSaved={false}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
      />
    );
    expect(container.querySelector(".prefs-savebar")?.classList.contains("visible")).toBe(false);
  });

  it("shows the unsaved-changes message with a singular count", () => {
    renderBar({ changedCount: 1 });
    expect(screen.getByText("unsaved changes")).toBeInTheDocument();
    expect(screen.getByText("1 field modified")).toBeInTheDocument();
  });

  it("pluralizes the changed-field count when greater than one", () => {
    renderBar({ changedCount: 3 });
    expect(screen.getByText("3 fields modified")).toBeInTheDocument();
  });

  it("shows the saved confirmation when justSaved is true", () => {
    renderBar({ justSaved: true });
    expect(screen.getByText(/saved · all changes applied/)).toBeInTheDocument();
    expect(screen.queryByText("unsaved changes")).toBeNull();
  });

  it("calls onSave and onDiscard when the buttons are clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderBar();
    await user.click(screen.getByRole("button", { name: /save/ }));
    await user.click(screen.getByRole("button", { name: /discard/ }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onDiscard).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons when not dirty", () => {
    renderBar({ dirty: false });
    expect(screen.getByRole("button", { name: /save/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /discard/ })).toBeDisabled();
  });

  it("disables both buttons while saving and shows the saving label", () => {
    renderBar({ saving: true });
    expect(screen.getByRole("button", { name: /saving…/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /discard/ })).toBeDisabled();
  });
});
