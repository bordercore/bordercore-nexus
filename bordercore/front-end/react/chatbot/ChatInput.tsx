import React, { useEffect, useRef } from "react";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onEscape: () => void;
  isStreaming: boolean;
  autoFocus?: boolean;
}

const MIN_ROWS = 1;
const MAX_ROWS = 6;

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  onEscape,
  isStreaming,
  autoFocus,
}: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea between MIN_ROWS and MAX_ROWS rows.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const max = lineHeight * MAX_ROWS;
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Chat owns the keystroke — don't let underlying page shortcuts (drill, blob,
    // etc.) react to letters the user is typing into the chat.
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onEscape();
    }
  };

  return (
    <div className="chatbot-input-area">
      <textarea
        ref={ref}
        className="chatbot-input"
        rows={MIN_ROWS}
        placeholder="ask anything…  (shift-↵ for newline)"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onKeyUp={e => e.stopPropagation()}
      />
      <div className="chatbot-keyboard-hints">
        <span>
          <kbd>↵</kbd> send <kbd>⇧↵</kbd> newline <kbd>esc</kbd> close
        </span>
        {isStreaming && (
          <button type="button" className="chatbot-stop-btn" onClick={onStop}>
            ■ stop
          </button>
        )}
      </div>
    </div>
  );
}

export default ChatInput;
