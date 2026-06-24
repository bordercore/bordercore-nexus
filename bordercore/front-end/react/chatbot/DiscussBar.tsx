import React from "react";

interface DiscussBarProps {
  onAnswer: () => void;
  onExplain: () => void;
  onRelated: () => void;
  disabled: boolean;
  showHint: boolean;
}

// Shown when the chatbot is grounded in a drill question ("Discuss"). The chips
// are shortcuts — one asks the AI to answer the flashcard directly, one to
// explain the concepts behind it, and one to generate a fresh, related
// question and answer. Otherwise the user can type a free-form question and
// the flashcard is sent as context.
export function DiscussBar({
  onAnswer,
  onExplain,
  onRelated,
  disabled,
  showHint,
}: DiscussBarProps) {
  return (
    <div className="chatbot-discuss-bar">
      <button type="button" className="chatbot-discuss-chip" onClick={onAnswer} disabled={disabled}>
        Answer this question
      </button>
      <button
        type="button"
        className="chatbot-discuss-chip"
        onClick={onExplain}
        disabled={disabled}
      >
        Explain the concepts
      </button>
      <button
        type="button"
        className="chatbot-discuss-chip"
        onClick={onRelated}
        disabled={disabled}
      >
        Ask related question
      </button>
      {showHint && (
        <span className="chatbot-discuss-hint">
          Ask anything about this question, or use a shortcut above.
        </span>
      )}
    </div>
  );
}

export default DiscussBar;
