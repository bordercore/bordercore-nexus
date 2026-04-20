import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { Pagination } from "./Pagination";
import type { Paginator } from "./types";

function paginator(current: number, total: number): Paginator {
  return {
    page_number: current,
    num_pages: total,
    has_previous: current > 1,
    has_next: current < total,
    previous_page_number: current > 1 ? current - 1 : undefined,
    next_page_number: current < total ? current + 1 : undefined,
    range: Array.from({ length: total }, (_, i) => i + 1),
  };
}

/**
 * Extract the middle of the pagination (excluding prev/next arrow buttons)
 * as a compact string[]: "N" for page N, "..." for an ellipsis.
 */
function visiblePages(container: HTMLElement): string[] {
  const root = container.querySelector(".search-pagination");
  if (!root) return [];
  const children = Array.from(root.children);
  // First and last are the prev/next arrow buttons.
  return children.slice(1, -1).map(el => {
    if (el.classList.contains("search-pagination-ellipsis")) return "...";
    return (el.textContent ?? "").trim();
  });
}

describe("Pagination", () => {
  it("renders nothing when there is only one page", () => {
    const { container } = render(<Pagination paginator={paginator(1, 1)} />);
    expect(container.querySelector(".search-pagination")).toBeNull();
  });

  it("renders all pages without ellipsis when total <= 7", () => {
    const { container } = render(<Pagination paginator={paginator(3, 7)} />);
    expect(visiblePages(container)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  });

  it("shows trailing ellipsis only when current page is near the start", () => {
    const { container } = render(<Pagination paginator={paginator(1, 10)} />);
    expect(visiblePages(container)).toEqual(["1", "2", "...", "10"]);
  });

  it("shows leading ellipsis only when current page is near the end", () => {
    const { container } = render(<Pagination paginator={paginator(10, 10)} />);
    expect(visiblePages(container)).toEqual(["1", "...", "9", "10"]);
  });

  it("shows both ellipses with a 3-page window when current is in the middle", () => {
    const { container } = render(<Pagination paginator={paginator(5, 10)} />);
    expect(visiblePages(container)).toEqual(["1", "...", "4", "5", "6", "...", "10"]);
  });

  it("shows no leading ellipsis at the boundary current=3", () => {
    const { container } = render(<Pagination paginator={paginator(3, 10)} />);
    expect(visiblePages(container)).toEqual(["1", "2", "3", "4", "...", "10"]);
  });

  it("shows no trailing ellipsis at the boundary current=total-2", () => {
    const { container } = render(<Pagination paginator={paginator(8, 10)} />);
    expect(visiblePages(container)).toEqual(["1", "...", "7", "8", "9", "10"]);
  });

  it("marks the active page with the 'active' class", () => {
    const { container } = render(<Pagination paginator={paginator(5, 10)} />);
    const active = container.querySelectorAll(".search-pagination-btn.active");
    expect(active).toHaveLength(1);
    expect(active[0].textContent?.trim()).toBe("5");
  });

  it("calls onPageChange with the target page when a page link is clicked", () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <Pagination paginator={paginator(5, 10)} onPageChange={onPageChange} />
    );
    const page6 = Array.from(container.querySelectorAll(".search-pagination-btn")).find(
      el => el.textContent?.trim() === "6"
    ) as HTMLElement;
    page6.click();
    expect(onPageChange).toHaveBeenCalledWith(6);
  });
});
