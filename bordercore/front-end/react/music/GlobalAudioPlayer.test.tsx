import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  handlers: {} as Record<string, (data: unknown) => void>,
  playerProps: null as any,
}));

vi.mock("../utils/reactUtils", () => ({
  EventBus: {
    $emit: mocks.emit,
    $on: (name: string, cb: (data: unknown) => void) => {
      mocks.handlers[name] = cb;
    },
    $off: vi.fn(),
  },
  getCsrfToken: () => "tok",
}));

// Stub the audio player: it renders nothing but records the props it was
// handed so the test can drive onAudioPlay (the path that starts the
// "mark as listened" timer in production).
vi.mock("react-jinke-music-player", () => ({
  default: (props: any) => {
    mocks.playerProps = props;
    return null;
  },
}));
vi.mock("react-jinke-music-player/assets/index.css", () => ({}));

import GlobalAudioPlayer from "./GlobalAudioPlayer";

const LISTEN_TIMEOUT = 10000;

// Emit a play-track event, then simulate the player actually starting
// playback. onAudioPlay (fired after the config re-render) is what schedules
// the listen timer with a populated config.
async function playSong() {
  await act(async () => {
    mocks.handlers["play-track"]({
      track: { uuid: "u1", title: "Song" },
      trackList: [{ uuid: "u1", title: "Song" }],
      songUrl: "/m/",
      markListenedToUrl: "/music/mark_song_as_listened_to/00000000-0000-0000-0000-000000000000",
    });
  });
  await act(async () => {
    mocks.playerProps.onAudioPlay({ uuid: "u1", name: "Song" });
  });
}

const toastCalls = () => mocks.emit.mock.calls.filter(c => c[0] === "toast");

describe("GlobalAudioPlayer mark-as-listened", () => {
  beforeEach(() => {
    mocks.emit.mockReset();
    mocks.handlers = {};
    mocks.playerProps = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("surfaces a danger toast when marking a song as listened fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    render(<GlobalAudioPlayer />);
    await playSong();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LISTEN_TIMEOUT);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toastCalls()).toHaveLength(1);
    expect(toastCalls()[0][1]).toEqual(expect.objectContaining({ variant: "danger" }));
  });

  it("does not toast when marking a song as listened succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    render(<GlobalAudioPlayer />);
    await playSong();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LISTEN_TIMEOUT);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toastCalls()).toHaveLength(0);
  });
});
