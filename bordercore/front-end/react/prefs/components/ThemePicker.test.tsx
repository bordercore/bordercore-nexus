import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThemePicker, type ThemeOption } from "./ThemePicker";

const THEMES: ThemeOption[] = [
  { value: "dark", label: "Dark", bg: "#000", panel: "#111", accent: "#0f0", text: "#fff" },
  { value: "light", label: "Light", bg: "#fff", panel: "#eee", accent: "#00f", text: "#000" },
];

describe("ThemePicker", () => {
  it("renders one button per theme with its label", () => {
    render(<ThemePicker value="dark" onChange={vi.fn()} themes={THEMES} />);
    expect(screen.getByRole("button", { name: /Dark/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Light/ })).toBeInTheDocument();
  });

  it("marks only the active theme as selected (aria-pressed + class)", () => {
    render(<ThemePicker value="dark" onChange={vi.fn()} themes={THEMES} />);
    const dark = screen.getByRole("button", { name: /Dark/ });
    const light = screen.getByRole("button", { name: /Light/ });
    expect(dark).toHaveAttribute("aria-pressed", "true");
    expect(light).toHaveAttribute("aria-pressed", "false");
    expect(dark.className).toContain("selected");
    expect(light.className).not.toContain("selected");
  });

  it("emits onChange with the clicked theme's value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ThemePicker value="dark" onChange={onChange} themes={THEMES} />);
    await user.click(screen.getByRole("button", { name: /Light/ }));
    expect(onChange).toHaveBeenCalledWith("light");
  });

  it("exposes the theme value as a data-theme attribute", () => {
    render(<ThemePicker value="dark" onChange={vi.fn()} themes={THEMES} />);
    expect(screen.getByRole("button", { name: /Dark/ })).toHaveAttribute("data-theme", "dark");
  });
});
