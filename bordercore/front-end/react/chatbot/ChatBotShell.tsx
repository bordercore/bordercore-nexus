import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ChatBotShellProps {
  pinned: boolean;
  pinnedWidth: number;
  onPinnedWidthChange: (w: number) => void;
  onClose: () => void;
  children: React.ReactNode;
}

const MIN_W = 300;
const MAX_W = 600;

export function ChatBotShell({
  pinned,
  pinnedWidth,
  onPinnedWidthChange,
  onClose,
  children,
}: ChatBotShellProps) {
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!pinned) return;
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const w = window.innerWidth - e.clientX;
      onPinnedWidthChange(Math.min(MAX_W, Math.max(MIN_W, w)));
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [pinned, onPinnedWidthChange]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "ew-resize";
  };

  const shellStyle: React.CSSProperties = pinned ? { width: `${pinnedWidth}px` } : {};

  const className = "chatbot-modal" + (pinned ? " chatbot-modal--pinned" : " refined-modal");

  return createPortal(
    <>
      {!pinned && <div className="refined-modal-scrim" onClick={onClose} />}
      <div
        className={className}
        role="dialog"
        aria-modal={pinned ? "false" : "true"}
        aria-label="ask the assistant"
        // must remain inline: pinnedWidth is a runtime value with no CSS-class equivalent
        style={shellStyle}
      >
        {pinned && (
          <div className="chatbot-resize-handle" onMouseDown={startResize} aria-hidden="true" />
        )}
        {children}
      </div>
    </>,
    document.body
  );
}

export default ChatBotShell;
