import React, { useRef, useEffect, useCallback } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-sql";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder = "Your SQL Here...",
  className = "",
  rows = 3,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const codeRef = useRef<HTMLElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const updateHighlighting = useCallback(() => {
    if (!codeRef.current) return;
    // Escape HTML entities and set text content
    codeRef.current.textContent = value + (value.endsWith("\n") ? " " : "");
    Prism.highlightElement(codeRef.current);
  }, [value]);

  useEffect(() => {
    updateHighlighting();
  }, [updateHighlighting]);

  const syncScroll = useCallback(() => {
    if (!textareaRef.current || !preRef.current) return;
    preRef.current.scrollTop = textareaRef.current.scrollTop;
    preRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }, []);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleInternalKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const element = textareaRef.current;
      if (!element) return;

      const start = element.selectionStart;
      const end = element.selectionEnd;

      const newValue = value.substring(0, start) + "\t" + value.substring(end);
      onChange(newValue);

      // Set cursor position after the tab (needs to happen after re-render)
      setTimeout(() => {
        element.selectionStart = element.selectionEnd = start + 1;
      }, 0);
    }

    if (onKeyDown) {
      onKeyDown(event);
    }
  };

  return (
    <div className={`code-input code-input-pre-element-styled ${className}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextareaChange}
        onKeyDown={handleInternalKeyDown}
        onScroll={syncScroll}
        spellCheck={false}
        placeholder={placeholder}
        rows={rows}
      />
      <pre ref={preRef} className="language-sql" aria-hidden="true">
        <code ref={codeRef} className="language-sql" />
      </pre>
    </div>
  );
};

export default SqlEditor;
