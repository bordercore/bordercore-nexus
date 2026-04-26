import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import BookmarkMetaStrip from "./BookmarkMetaStrip";

const baseProps = {
  created: "2026-01-12T10:00:00Z",
  modified: "2026-04-20T10:00:00Z",
  lastCheck: null as string | null,
  lastResponseCode: null as number | null,
};

describe("BookmarkMetaStrip", () => {
  it("renders the added date", () => {
    render(<BookmarkMetaStrip {...baseProps} />);
    expect(screen.getByText(/added/i)).toBeInTheDocument();
    expect(screen.getByText(/Jan 12, 2026/)).toBeInTheDocument();
  });

  it("renders modified only when it differs from created", () => {
    render(<BookmarkMetaStrip {...baseProps} />);
    expect(screen.getByText(/modified/i)).toBeInTheDocument();

    const sameDates = { ...baseProps, modified: baseProps.created };
    const { container } = render(<BookmarkMetaStrip {...sameDates} />);
    expect(container.textContent).not.toMatch(/modified/i);
  });

  it("shows 'Never checked' when lastCheck is null", () => {
    render(<BookmarkMetaStrip {...baseProps} />);
    const chip = screen.getByLabelText("last check status");
    expect(chip).toHaveTextContent(/never checked/i);
    expect(chip).toHaveClass("never");
  });

  it("renders OK chip for 2xx response", () => {
    render(
      <BookmarkMetaStrip {...baseProps} lastCheck="2026-04-25T10:00:00Z" lastResponseCode={200} />
    );
    const chip = screen.getByLabelText("last check status");
    expect(chip).toHaveTextContent(/OK 200/);
    expect(chip).toHaveClass("ok");
  });

  it("renders warn chip for 3xx redirect", () => {
    render(
      <BookmarkMetaStrip {...baseProps} lastCheck="2026-04-25T10:00:00Z" lastResponseCode={301} />
    );
    const chip = screen.getByLabelText("last check status");
    expect(chip).toHaveTextContent(/Redirect 301/);
    expect(chip).toHaveClass("warn");
  });

  it("renders broken chip for 4xx response", () => {
    render(
      <BookmarkMetaStrip {...baseProps} lastCheck="2026-04-25T10:00:00Z" lastResponseCode={404} />
    );
    const chip = screen.getByLabelText("last check status");
    expect(chip).toHaveTextContent(/Broken 404/);
    expect(chip).toHaveClass("broken");
  });

  it("renders broken chip for 5xx response", () => {
    render(
      <BookmarkMetaStrip {...baseProps} lastCheck="2026-04-25T10:00:00Z" lastResponseCode={503} />
    );
    const chip = screen.getByLabelText("last check status");
    expect(chip).toHaveTextContent(/Broken 503/);
    expect(chip).toHaveClass("broken");
  });
});
