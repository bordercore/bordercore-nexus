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
  // Render as a non-clickable indicator when active.
  if (mode === "question" || mode === "exercise") {
    return (
      <div className="chatbot-mode-chips">
        <span className="chatbot-mode-chip chatbot-mode-chip--active chatbot-mode-chip--readonly">
          {mode}
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
