import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("renders the default 'enabled' label when value is true", () => {
    render(<Toggle value={true} onChange={vi.fn()} />);
    expect(screen.getByText("enabled")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("renders the default 'disabled' label when value is false", () => {
    render(<Toggle value={false} onChange={vi.fn()} />);
    expect(screen.getByText("disabled")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("renders custom on/off labels", () => {
    const { rerender } = render(
      <Toggle value={true} onChange={vi.fn()} onLabel="visible" offLabel="hidden" />
    );
    expect(screen.getByText("visible")).toBeInTheDocument();
    rerender(<Toggle value={false} onChange={vi.fn()} onLabel="visible" offLabel="hidden" />);
    expect(screen.getByText("hidden")).toBeInTheDocument();
  });

  it("calls onChange with the inverted value when clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle value={false} onChange={onChange} />);
    await user.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("inverts again when toggled from on", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle value={true} onChange={onChange} />);
    await user.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
