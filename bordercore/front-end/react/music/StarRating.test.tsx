import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("axios", () => ({
  default: { post: mocks.post },
}));

import StarRating from "./StarRating";

beforeEach(() => {
  mocks.post.mockReset();
  mocks.post.mockResolvedValue({ data: {} });
});

describe("StarRating", () => {
  it("renders five stars with the rated ones selected", () => {
    const { container } = render(
      <StarRating songUuid="s1" rating={3} setSongRatingUrl="/rate" onRatingChange={() => {}} />
    );
    expect(container.querySelectorAll(".rating")).toHaveLength(5);
    expect(container.querySelectorAll(".rating-star-selected")).toHaveLength(3);
  });

  it("posts the new rating and notifies on star click", async () => {
    const onRatingChange = vi.fn();
    const { container } = render(
      <StarRating
        songUuid="s1"
        rating={null}
        setSongRatingUrl="/rate"
        onRatingChange={onRatingChange}
      />
    );
    fireEvent.click(container.querySelectorAll(".rating")[3]);
    await vi.waitFor(() => expect(onRatingChange).toHaveBeenCalledWith("s1", 4));
    expect(mocks.post).toHaveBeenCalledWith("/rate", expect.anything(), expect.anything());
  });

  it("clears the rating when clicking the currently-set star", async () => {
    const onRatingChange = vi.fn();
    const { container } = render(
      <StarRating
        songUuid="s1"
        rating={4}
        setSongRatingUrl="/rate"
        onRatingChange={onRatingChange}
      />
    );
    fireEvent.click(container.querySelectorAll(".rating")[3]);
    await vi.waitFor(() => expect(onRatingChange).toHaveBeenCalledWith("s1", null));
  });

  it("applies the compact modifier class when compact is set", () => {
    const { container } = render(
      <StarRating
        songUuid="s1"
        rating={2}
        setSongRatingUrl="/rate"
        onRatingChange={() => {}}
        compact
      />
    );
    expect(container.querySelector(".rating-container-compact")).not.toBeNull();
  });
});
