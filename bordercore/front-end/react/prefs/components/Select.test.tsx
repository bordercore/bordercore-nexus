import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Select, type SelectOption } from "./Select";

const OPTIONS: SelectOption[] = [
  { value: "asc", label: "ascending" },
  { value: "desc", label: "descending" },
];

describe("Select", () => {
  it("renders each option", () => {
    render(<Select value="asc" onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.getByRole("option", { name: "ascending" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "descending" })).toBeInTheDocument();
  });

  it("reflects the supplied value", () => {
    render(<Select value="desc" onChange={vi.fn()} options={OPTIONS} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("desc");
  });

  it("calls onChange with the new value when the user picks a different option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select value="asc" onChange={onChange} options={OPTIONS} />);
    await user.selectOptions(screen.getByRole("combobox"), "desc");
    expect(onChange).toHaveBeenCalledWith("desc");
  });

  it("includes a placeholder option only when one is supplied", () => {
    const { rerender } = render(
      <Select value="" onChange={vi.fn()} options={OPTIONS} placeholder="pick one" />
    );
    expect(screen.getByRole("option", { name: "pick one" })).toBeInTheDocument();
    rerender(<Select value="asc" onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.queryByRole("option", { name: "pick one" })).toBeNull();
  });

  it("passes through the id attribute so external labels can target it", () => {
    render(<Select id="sort-order" value="asc" onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.getByRole("combobox")).toHaveAttribute("id", "sort-order");
  });
});
