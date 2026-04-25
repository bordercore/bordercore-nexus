import { describe, expect, it, beforeEach } from "vitest";
import { loadUiState, saveUiState, DEFAULT_UI_STATE } from "./storage";

describe("chatbot storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns defaults when nothing is stored", () => {
    expect(loadUiState()).toEqual(DEFAULT_UI_STATE);
  });

  it("returns defaults when stored value is unparseable JSON", () => {
    window.localStorage.setItem("bordercore.chatbot.ui", "{not json");
    expect(loadUiState()).toEqual(DEFAULT_UI_STATE);
  });

  it("merges stored partial state over defaults", () => {
    window.localStorage.setItem("bordercore.chatbot.ui", JSON.stringify({ pinned: true }));
    expect(loadUiState()).toEqual({
      pinned: true,
      pinnedWidth: DEFAULT_UI_STATE.pinnedWidth,
    });
  });

  it("clamps pinnedWidth to [300, 600] on load", () => {
    window.localStorage.setItem(
      "bordercore.chatbot.ui",
      JSON.stringify({ pinned: true, pinnedWidth: 99 })
    );
    expect(loadUiState().pinnedWidth).toBe(300);

    window.localStorage.setItem(
      "bordercore.chatbot.ui",
      JSON.stringify({ pinned: true, pinnedWidth: 9999 })
    );
    expect(loadUiState().pinnedWidth).toBe(600);
  });

  it("saves state and reads it back round-trip", () => {
    saveUiState({ pinned: true, pinnedWidth: 420 });
    expect(loadUiState()).toEqual({ pinned: true, pinnedWidth: 420 });
  });
});
