import React, { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { useFocusOnCtrlK } from "./useFocusOnCtrlK";

function Probe({ value = "" }: { value?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useFocusOnCtrlK(ref);
  return <input ref={ref} defaultValue={value} aria-label="probe" />;
}

function GatedProbe({ mounted }: { mounted: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useFocusOnCtrlK(ref);
  return mounted ? <input ref={ref} aria-label="probe" /> : null;
}

describe("useFocusOnCtrlK", () => {
  it("focuses the ref on Cmd+K", () => {
    const { getByLabelText } = render(<Probe />);
    const input = getByLabelText("probe");
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(input);
  });

  it("focuses the ref on Ctrl+K", () => {
    const { getByLabelText } = render(<Probe />);
    const input = getByLabelText("probe");
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(document.activeElement).toBe(input);
  });

  it("is case-insensitive (K is the same as k)", () => {
    const { getByLabelText } = render(<Probe />);
    const input = getByLabelText("probe");
    fireEvent.keyDown(window, { key: "K", metaKey: true });
    expect(document.activeElement).toBe(input);
  });

  it("selects existing text so the next keystroke overwrites", () => {
    const { getByLabelText } = render(<Probe value="hello" />);
    const input = getByLabelText("probe") as HTMLInputElement;
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(5);
  });

  it("ignores plain k (no modifier)", () => {
    const { getByLabelText } = render(<Probe />);
    const input = getByLabelText("probe");
    fireEvent.keyDown(window, { key: "k" });
    expect(document.activeElement).not.toBe(input);
  });

  it("ignores other modified keys (Cmd+J)", () => {
    const { getByLabelText } = render(<Probe />);
    const input = getByLabelText("probe");
    fireEvent.keyDown(window, { key: "j", metaKey: true });
    expect(document.activeElement).not.toBe(input);
  });

  it("calls preventDefault so the browser shortcut is suppressed", () => {
    render(<Probe />);
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      cancelable: true,
    });
    const prevented = !window.dispatchEvent(event);
    expect(prevented).toBe(true);
  });

  it("no-ops silently when the ref's input is not mounted", () => {
    const { rerender } = render(<GatedProbe mounted={false} />);
    // Should not throw, should not focus anything unusual.
    const prior = document.activeElement;
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(prior);
    // Once mounted, focus works.
    rerender(<GatedProbe mounted={true} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect((document.activeElement as HTMLElement)?.getAttribute("aria-label")).toBe("probe");
  });

  it("removes the listener on unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Probe />);
    unmount();
    const hadKeydownCleanup = remove.mock.calls.some(([type]) => type === "keydown");
    expect(hadKeydownCleanup).toBe(true);
    remove.mockRestore();
  });
});
