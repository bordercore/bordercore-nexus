import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DrillOverviewPage from "./DrillOverviewPage";
import type { DrillPayload } from "./types";

// DrillPinnedTags and DrillDisabledTags fetch on mount via axios (doGet).
// Mock axios at the module level so those calls resolve silently.
vi.mock("axios", () => {
  const resolved = { data: { tag_list: [] } };
  const mock = Object.assign(vi.fn().mockResolvedValue(resolved), {
    get: vi.fn().mockResolvedValue(resolved),
    defaults: { xsrfCookieName: "", xsrfHeaderName: "", withCredentials: false },
  });
  return { default: mock };
});

// Also mock bootstrap's Modal since DrillPinnedTags / DrillDisabledTags reference it.
// vi.fn() with an arrow function can't be used as a constructor (new Modal(...)).
// Use a plain class so React's useEffect that calls `new Modal(el)` doesn't throw.
const mockModalShow = vi.fn();
const mockModalHide = vi.fn();
vi.mock("bootstrap", () => ({
  Modal: class {
    show() {
      mockModalShow();
    }
    hide() {
      mockModalHide();
    }
  },
}));

const payload: DrillPayload = {
  title: "Drill",
  urls: {
    drillList: "/drill/",
    drillAdd: "/drill/question/add/",
    startStudySession: "/drill/start_study_session",
    resume: "/drill/resume",
    getPinnedTags: "/drill/get_pinned_tags",
    pinTag: "/drill/pin_tag",
    unpinTag: "/drill/unpin_tag",
    sortPinnedTags: "/drill/sort_pinned_tags",
    getDisabledTags: "/drill/get_disabled_tags",
    disableTag: "/drill/disable_tag",
    enableTag: "/drill/enable_tag",
    tagSearch: "/tag/search",
    featuredTagInfo: "/drill/featured_tag_info",
  },
  session: null,
  studyScope: [
    { key: "all", label: "all questions", count: 642 },
    { key: "review", label: "needs review", count: 395 },
    { key: "favorites", label: "favorites", count: 51 },
    { key: "recent", label: "recent · 7d", count: 18 },
    { key: "random", label: "random · 10", count: 10 },
    { key: "keyword", label: "keyword search", count: null },
  ],
  intervals: [1, 2, 3, 5, 8, 13, 21, 30],
  responsesByKind: { easy: 412, good: 198, hard: 64, reset: 14 },
  totalProgress: {
    pct: 38,
    remaining: 395,
    total: 642,
    reviewedToday: 21,
    reviewedWeek: 148,
  },
  favoritesProgress: {
    pct: 27,
    remaining: 37,
    total: 51,
    reviewedToday: 4,
    reviewedWeek: 12,
  },
  schedule: [{ dow: "thu", date: "24", due: 395, state: "today" }],
  tagsNeedingReview: [
    {
      name: "numpy",
      progress: 30,
      todo: 5,
      count: 22,
      last_reviewed: "Jun 27, 2025",
      url: "/drill/start_study_session?study_method=tag&tags=numpy",
      overdueDays: 301,
      pip: "danger",
    },
  ],
  pinned: [],
  disabled: [],
  featured: null,
  streak: 17,
  nextDue: "in 02h 14m",
  activity28d: Array.from({ length: 28 }, (_, i) => i % 5),
  recentResponses: [{ question: "lambda calculus", response: "easy", ago: "2m" }],
};

describe("DrillOverviewPage", () => {
  it("renders the page head, hero, schedule, sidebar, and tags table", () => {
    // Wrapped `DrillPinnedTags` / `DrillDisabledTags` fetch on mount.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tag_list: [] }),
    }) as unknown as typeof fetch;

    render(<DrillOverviewPage payload={payload} />);

    // Page head
    expect(screen.getByText(/spaced-repetition overview/i)).toBeInTheDocument();
    // Sidebar scope
    expect(screen.getByText("all questions")).toBeInTheDocument();
    // Sidebar sub-block headings
    expect(screen.getByText(/^study scope$/)).toBeInTheDocument();
    expect(screen.getByText(/^intervals$/)).toBeInTheDocument();
    expect(screen.getByText(/^by response$/)).toBeInTheDocument();
    // Hero action card (getAllByRole because the StudyModal also renders a "Study" submit button)
    expect(screen.getAllByRole("button", { name: /Study/i }).length).toBeGreaterThan(0);
    // Streak in eyebrow meta (appears in both ActionCard and SessionMeta)
    expect(screen.getAllByText(/17 days/).length).toBeGreaterThan(0);
    // Tags table
    expect(screen.getByText(/Tags needing review/i)).toBeInTheDocument();
    expect(screen.getByText("numpy")).toBeInTheDocument();
    // Schedule
    expect(screen.getByText(/Review Schedule/i)).toBeInTheDocument();
  });

  it("initializes activeScope from session.type when a session exists", () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tag_list: [] }),
    }) as unknown as typeof fetch;

    const withSession: DrillPayload = {
      ...payload,
      session: {
        type: "favorites",
        tag: null,
        list: ["u1", "u2"],
        current: "u1",
        completed: 0,
        total: 2,
        scopeLabel: "favorites",
        nextIn: "in 02h 14m",
      },
    };

    render(<DrillOverviewPage payload={withSession} />);

    // Resume link appears when a session exists
    const resume = screen.getByRole("link", { name: /Resume/i });
    expect(resume).toHaveAttribute("href", withSession.urls.resume);

    // Session-status line shows the scope label
    expect(screen.getByText(/studying/i)).toBeInTheDocument();
    // "favorites" appears in both the scope nav and session-status; check it's present at least once
    expect(screen.getAllByText(/favorites/).length).toBeGreaterThan(0);

    // Direct check that activeScope was initialized to "favorites":
    // the "favorites" nav item in StudyScopeNav should have the `active` class.
    const favoritesNavItem = screen
      .getAllByText("favorites")
      .find(el => el.tagName === "SPAN" && el.className === "label");
    expect(favoritesNavItem).toBeDefined();
    expect(favoritesNavItem?.closest("a")).toHaveClass("active");
  });

  it("opens the study modal when the Study button is clicked", () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tag_list: [] }),
    }) as unknown as typeof fetch;

    render(<DrillOverviewPage payload={payload} />);

    // Modal closed initially: title isn't rendered.
    expect(screen.queryByText("Start a session")).not.toBeInTheDocument();

    // Click Study (the hero button).
    const studyButton = screen.getAllByRole("button", { name: /Study/i })[0];
    fireEvent.click(studyButton);

    // Modal title is now in the DOM (portaled to body — testing-library still finds it).
    expect(screen.getByText("Start a session")).toBeInTheDocument();
    // Form action points at startStudySession.
    const form = document.querySelector(`form[action="${payload.urls.startStudySession}"]`);
    expect(form).not.toBeNull();
  });
});
