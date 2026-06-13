import React from "react";

interface DiscussBarProps {
  onAnswer: () => void;
  disabled: boolean;
  showHint: boolean;
}

// Shown when the chatbot is grounded in a drill question ("Discuss"). The chip
// is a shortcut that asks the AI to answer the flashcard directly; otherwise
// the user can type a free-form question and the flashcard is sent as context.
export function DiscussBar({ onAnswer, disabled, showHint }: DiscussBarProps) {
  return (
    <div className="chatbot-discuss-bar">
      <button type="button" className="chatbot-discuss-chip" onClick={onAnswer} disabled={disabled}>
        Answer this question
      </button>
      {showHint && (
        <span className="chatbot-discuss-hint">
          Ask anything about this question, or tap “Answer this question”.
        </span>
      )}
    </div>
  );
}

export default DiscussBar;
