import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DrillTopbar from "./DrillTopbar";

const baseProps = {
  isFavorite: false,
  onFavoriteToggle: vi.fn(),
  onAskChatbot: vi.fn(),
  onOpenPythonConsole: vi.fn(),
  addQuestionUrl: "/drill/add",
  editUrl: "/drill/edit/1",
  studySession: null,
  studySessionProgress: 0,
};

/** The span wrapping the heart icon — the element the beat animates. */
function heartIcon(): HTMLElement {
  const button = screen.getByRole("button", { name: "Add favorite" });
  const span = button.querySelector(".drill-fav-icon");
  if (!span) throw new Error("favorite button has no icon wrapper");
  return span as HTMLElement;
}

describe("DrillTopbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Run rAF callbacks synchronously so the beat class lands within the test.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls onFavoriteToggle when the favorite button is clicked", () => {
    render(<DrillTopbar {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Add favorite" }));
    expect(baseProps.onFavoriteToggle).toHaveBeenCalledTimes(1);
  });

  it("adds the beat class to the heart icon on click", () => {
    render(<DrillTopbar {...baseProps} />);
    expect(heartIcon()).not.toHaveClass("drill-fav-beat");

    fireEvent.click(screen.getByRole("button", { name: "Add favorite" }));
    expect(heartIcon()).toHaveClass("drill-fav-beat");
  });

  it("clears the beat class once the animation ends", () => {
    render(<DrillTopbar {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Add favorite" }));
    expect(heartIcon()).toHaveClass("drill-fav-beat");

    fireEvent.animationEnd(heartIcon());
    expect(heartIcon()).not.toHaveClass("drill-fav-beat");
  });

  it("replays the beat when the favorite is toggled again", () => {
    render(<DrillTopbar {...baseProps} />);
    const button = screen.getByRole("button", { name: "Add favorite" });

    fireEvent.click(button);
    fireEvent.animationEnd(heartIcon());
    expect(heartIcon()).not.toHaveClass("drill-fav-beat");

    fireEvent.click(button);
    expect(heartIcon()).toHaveClass("drill-fav-beat");
    expect(baseProps.onFavoriteToggle).toHaveBeenCalledTimes(2);
  });
});
