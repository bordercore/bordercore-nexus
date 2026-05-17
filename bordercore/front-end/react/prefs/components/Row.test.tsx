import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Row } from "./Row";

describe("Row", () => {
  it("renders the label and children", () => {
    render(
      <Row label="Display name">
        <input data-testid="child" />
      </Row>
    );
    expect(screen.getByText("Display name")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders the hint when supplied", () => {
    render(
      <Row label="Email" hint="we never spam">
        <input />
      </Row>
    );
    expect(screen.getByText("we never spam")).toBeInTheDocument();
  });

  it("wires htmlFor to associate the label with an input", () => {
    render(
      <Row label="Email" htmlFor="email-field">
        <input id="email-field" />
      </Row>
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("renders each error message", () => {
    render(
      <Row label="Email" errors={["too short", "missing @"]}>
        <input />
      </Row>
    );
    expect(screen.getByText("too short")).toBeInTheDocument();
    expect(screen.getByText("missing @")).toBeInTheDocument();
  });

  it("omits the error container when there are no errors", () => {
    const { container } = render(
      <Row label="Email">
        <input />
      </Row>
    );
    expect(container.querySelector(".prefs-errors")).toBeNull();
  });

  it("omits the error container when the errors array is empty", () => {
    const { container } = render(
      <Row label="Email" errors={[]}>
        <input />
      </Row>
    );
    expect(container.querySelector(".prefs-errors")).toBeNull();
  });
});
