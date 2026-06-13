import React from "react";
import type { ChatMode } from "./types";

interface ModeChipsProps {
  mode: ChatMode;
  hasBlobContext: boolean;
  showDjango: boolean;
  onChange: (mode: ChatMode) => void;
}

const SELECTABLE_MODES: ChatMode[] = ["chat", "notes", "blob", "django"];

export function ModeChips({ mode, hasBlobContext, showDjango, onChange }: ModeChipsProps) {
  // question / exercise are set by event payload, never user-selectable.
  // Question mode shows its own DiscussBar as the context indicator, so no
  // chip is needed here; exercise mode still renders a non-clickable indicator.
  if (mode === "question") {
    return null;
  }
  if (mode === "exercise") {
    return (
      <div className="chatbot-mode-chips">
        <span className="chatbot-mode-chip chatbot-mode-chip--active chatbot-mode-chip--readonly">
          exercise
        </span>
      </div>
    );
  }

  const visible = SELECTABLE_MODES.filter(m => {
    if (m === "blob") return hasBlobContext;
    if (m === "django") return showDjango;
    return true;
  });

  return (
    <div className="chatbot-mode-chips" role="group" aria-label="chat mode">
      {visible.map(m => (
        <button
          key={m}
          type="button"
          className={"chatbot-mode-chip" + (m === mode ? " chatbot-mode-chip--active" : "")}
          onClick={() => onChange(m)}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

export default ModeChips;
