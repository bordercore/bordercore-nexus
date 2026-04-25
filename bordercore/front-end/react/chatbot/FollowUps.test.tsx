import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FollowUps } from "./FollowUps";

describe("FollowUps", () => {
  it("renders nothing when suggestions is empty", () => {
    const { container } = render(<FollowUps suggestions={[]} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one button per suggestion", () => {
    render(<FollowUps suggestions={["a", "b", "c"]} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("calls onSelect with the clicked suggestion", async () => {
    const onSelect = vi.fn();
    render(<FollowUps suggestions={["explain", "elaborate"]} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "explain" }));
    expect(onSelect).toHaveBeenCalledWith("explain");
  });
});
