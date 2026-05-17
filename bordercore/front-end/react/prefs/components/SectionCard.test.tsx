import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SectionCard } from "./SectionCard";

describe("SectionCard", () => {
  it("renders the title and children", () => {
    render(
      <SectionCard title="Account">
        <p>body content</p>
      </SectionCard>
    );
    expect(screen.getByRole("heading", { level: 2, name: "Account" })).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("renders the meta label when supplied", () => {
    render(
      <SectionCard title="Account" meta="last updated yesterday">
        <span />
      </SectionCard>
    );
    expect(screen.getByText("last updated yesterday")).toBeInTheDocument();
  });

  it("omits the meta span when not supplied", () => {
    const { container } = render(
      <SectionCard title="Account">
        <span />
      </SectionCard>
    );
    expect(container.querySelector(".meta")).toBeNull();
  });
});
