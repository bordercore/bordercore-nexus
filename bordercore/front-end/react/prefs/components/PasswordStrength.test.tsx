import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PasswordStrength, computeStrength } from "./PasswordStrength";

describe("computeStrength", () => {
  it("reports zero score for an empty password", () => {
    const r = computeStrength("", "");
    expect(r.score).toBe(0);
    expect(r.level).toBe("weak");
    expect(r.checks.every(c => !c.ok)).toBe(true);
  });

  it("checks length, case, digits, and symbols independently", () => {
    const r = computeStrength("Abcdef1!longer", "Abcdef1!longer");
    const byLabel = Object.fromEntries(r.checks.map(c => [c.label, c.ok]));
    expect(byLabel["≥ 12 chars"]).toBe(true);
    expect(byLabel["uppercase"]).toBe(true);
    expect(byLabel["lowercase"]).toBe(true);
    expect(byLabel["number"]).toBe(true);
    expect(byLabel["symbol"]).toBe(true);
    expect(byLabel["matches"]).toBe(true);
    expect(r.score).toBe(6);
    expect(r.level).toBe("excellent");
  });

  it("marks 'matches' false when confirm differs", () => {
    const r = computeStrength("abcdef", "different");
    expect(r.checks.find(c => c.label === "matches")?.ok).toBe(false);
  });

  it("marks 'matches' false when both are empty (avoids spurious match)", () => {
    const r = computeStrength("", "");
    expect(r.checks.find(c => c.label === "matches")?.ok).toBe(false);
  });

  it.each<[string, string, "weak" | "ok" | "strong" | "excellent"]>([
    ["a", "a", "weak"], // score 2: lowercase + matches
    ["Ab", "Ab", "ok"], // score 3: upper + lower + matches
    ["Ab1", "Ab1", "ok"], // score 4: upper + lower + number + matches
    ["Ab1!short", "Ab1!short", "strong"], // score 5: + symbol
    ["Abcdef1!long1", "Abcdef1!long1", "excellent"], // score 6: + length
  ])("maps password %s to level %s", (pw, confirm, level) => {
    expect(computeStrength(pw, confirm).level).toBe(level);
  });
});

describe("PasswordStrength", () => {
  it("renders nothing for an empty password", () => {
    const { container } = render(<PasswordStrength password="" confirm="" />);
    expect(container.textContent).toBe("");
  });

  it("renders six strength bars and the checklist when a password is supplied", () => {
    const { container } = render(<PasswordStrength password="abc" confirm="abc" />);
    expect(container.querySelectorAll(".prefs-pw-strength .bar")).toHaveLength(6);
    expect(screen.getByText("strength")).toBeInTheDocument();
    expect(screen.getByText("≥ 12 chars")).toBeInTheDocument();
    expect(screen.getByText("matches")).toBeInTheDocument();
  });

  it("marks satisfied checks with the 'ok' class", () => {
    const { container } = render(
      <PasswordStrength password="Abcdef1!longer" confirm="Abcdef1!longer" />
    );
    const items = container.querySelectorAll(".prefs-pw-checklist .item");
    expect(items.length).toBeGreaterThan(0);
    expect(Array.from(items).every(el => el.classList.contains("ok"))).toBe(true);
  });
});
