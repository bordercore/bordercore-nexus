import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import RecentPlaysCard from "./RecentPlaysCard";
import type { RecentPlayedSong } from "./types";

const songs: RecentPlayedSong[] = [
  { uuid: "s1", title: "Just Now", artist_name: "A", artist_url: "/a" },
  { uuid: "s2", title: "Older", artist_name: "B", artist_url: "/b" },
];

describe("RecentPlaysCard", () => {
  it("renders rows with numeric prefixes", () => {
    render(<RecentPlaysCard songs={songs} playsToday={5} />);
    expect(screen.getByText("Just Now")).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText(/2 of 5/)).toBeInTheDocument();
  });
});
