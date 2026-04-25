import type { ChatBotPersistedUI } from "./types";

const KEY = "bordercore.chatbot.ui";

export const DEFAULT_UI_STATE: ChatBotPersistedUI = {
  pinned: false,
  pinnedWidth: 360,
};

const MIN_WIDTH = 300;
const MAX_WIDTH = 600;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function loadUiState(): ChatBotPersistedUI {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_UI_STATE;
    const parsed = JSON.parse(raw) as Partial<ChatBotPersistedUI>;
    return {
      pinned: typeof parsed.pinned === "boolean" ? parsed.pinned : DEFAULT_UI_STATE.pinned,
      pinnedWidth: clamp(
        typeof parsed.pinnedWidth === "number" ? parsed.pinnedWidth : DEFAULT_UI_STATE.pinnedWidth,
        MIN_WIDTH,
        MAX_WIDTH
      ),
    };
  } catch {
    return DEFAULT_UI_STATE;
  }
}

export function saveUiState(state: ChatBotPersistedUI): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore quota / privacy-mode errors
  }
}
