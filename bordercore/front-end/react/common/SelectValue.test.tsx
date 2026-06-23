import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SelectValue from "./SelectValue";

const axiosGet = vi.fn();

vi.mock("axios", () => {
  const mock = Object.assign(vi.fn(), {
    get: (...args: any[]) => axiosGet(...args),
    isCancel: () => false,
    defaults: { xsrfCookieName: "", xsrfHeaderName: "", withCredentials: false },
  });
  return { default: mock };
});

describe("SelectValue", () => {
  beforeEach(() => {
    axiosGet.mockReset();
    axiosGet.mockResolvedValue({ data: [{ label: "alpha" }, { label: "beta" }] });
  });

  it("opens a suggestion dropdown when a searchUrl is provided", async () => {
    render(<SelectValue searchUrl="/tags?query=" />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "al" } });

    await waitFor(() => {
      expect(document.querySelector(".select-value-dropdown")).not.toBeNull();
    });
    expect(axiosGet).toHaveBeenCalled();
  });

  it("performs no request and shows no dropdown when searchUrl is empty", async () => {
    const onSearch = vi.fn();
    render(<SelectValue searchUrl="" onSearch={onSearch} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "django" } });

    // Give any (unexpected) debounced request time to fire.
    await new Promise(resolve => setTimeout(resolve, 350));
    expect(axiosGet).not.toHaveBeenCalled();
    expect(document.querySelector(".select-value-dropdown")).toBeNull();

    // Enter still submits the typed term.
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSearch).toHaveBeenCalledWith("django");
  });
});
