import React, { useState, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUndo,
  faRedo,
  faBold,
  faItalic,
  faStrikethrough,
  faQuoteRight,
  faCode,
  faListUl,
  faListOl,
  faTable,
  faMinus,
  faLink,
  faImage,
  faHeading,
} from "@fortawesome/free-solid-svg-icons";

interface MarkdownEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  onDrop?: (event: React.DragEvent) => void;
  className?: string;
  isDragOver?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
}

export interface MarkdownEditorHandle {
  insert: (callback: (selected: string) => { text: string; selected: string }) => void;
  clear: () => void;
  getValue: () => string;
  focus: () => void;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      initialContent = "",
      onChange,
      onDrop,
      className = "",
      isDragOver = false,
      onDragOver,
      onDragLeave,
    },
    ref
  ) {
    const [content, setContent] = useState(initialContent);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const historyRef = useRef<string[]>([initialContent]);
    const historyIndexRef = useRef(0);

    const updateContent = useCallback(
      (newContent: string, addToHistory = true) => {
        setContent(newContent);
        onChange?.(newContent);
        if (addToHistory) {
          // Add to history
          historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
          historyRef.current.push(newContent);
          historyIndexRef.current = historyRef.current.length - 1;
        }
      },
      [onChange]
    );

    const insertText = useCallback(
      (callback: (selected: string) => { text: string; selected: string }) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);

        const { text, selected } = callback(selectedText);

        const newContent = content.substring(0, start) + text + content.substring(end);
        updateContent(newContent);

        // Set cursor position after insertion
        setTimeout(() => {
          const newStart = start + text.indexOf(selected);
          const newEnd = newStart + selected.length;
          textarea.focus();
          textarea.setSelectionRange(newStart, newEnd);
        }, 0);
      },
      [content, updateContent]
    );

    const wrapSelection = useCallback(
      (prefix: string, suffix: string, placeholder: string) => {
        insertText(selected => {
          const textContent = selected || placeholder;
          return {
            text: `${prefix}${textContent}${suffix}`,
            selected: textContent,
          };
        });
      },
      [insertText]
    );

    const insertAtCursor = useCallback(
      (text: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const newContent = content.substring(0, start) + text + content.substring(end);
        updateContent(newContent);

        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + text.length, start + text.length);
        }, 0);
      },
      [content, updateContent]
    );

    const undo = useCallback(() => {
      if (historyIndexRef.current > 0) {
        historyIndexRef.current--;
        const prevContent = historyRef.current[historyIndexRef.current];
        setContent(prevContent);
        onChange?.(prevContent);
      }
    }, [onChange]);

    const redo = useCallback(() => {
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyIndexRef.current++;
        const nextContent = historyRef.current[historyIndexRef.current];
        setContent(nextContent);
        onChange?.(nextContent);
      }
    }, [onChange]);

    useImperativeHandle(
      ref,
      () => ({
        insert: insertText,
        clear: () => {
          updateContent("");
        },
        getValue: () => content,
        focus: () => {
          textareaRef.current?.focus();
        },
      }),
      [insertText, updateContent, content]
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateContent(e.target.value);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      onDrop?.(e);
    };

    const toolbarButtons = [
      { icon: faUndo, action: undo, title: "Undo" },
      { icon: faRedo, action: redo, title: "Redo" },
      { divider: true },
      {
        icon: faHeading,
        action: () => wrapSelection("## ", "", "heading"),
        title: "Heading",
      },
      {
        icon: faBold,
        action: () => wrapSelection("**", "**", "bold"),
        title: "Bold",
      },
      {
        icon: faItalic,
        action: () => wrapSelection("*", "*", "italic"),
        title: "Italic",
      },
      {
        icon: faStrikethrough,
        action: () => wrapSelection("~~", "~~", "strikethrough"),
        title: "Strikethrough",
      },
      {
        icon: faQuoteRight,
        action: () => wrapSelection("> ", "", "quote"),
        title: "Quote",
      },
      {
        icon: faCode,
        action: () => wrapSelection("`", "`", "code"),
        title: "Inline Code",
      },
      { divider: true },
      {
        icon: faListUl,
        action: () => insertAtCursor("\n- item\n"),
        title: "Unordered List",
      },
      {
        icon: faListOl,
        action: () => insertAtCursor("\n1. item\n"),
        title: "Ordered List",
      },
      {
        icon: faTable,
        action: () => insertAtCursor("\n| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n"),
        title: "Table",
      },
      { icon: faMinus, action: () => insertAtCursor("\n---\n"), title: "Horizontal Rule" },
      { divider: true },
      {
        icon: faLink,
        action: () => wrapSelection("[", "](url)", "link"),
        title: "Link",
      },
      {
        icon: faImage,
        action: () => insertAtCursor("![alt](image-url)"),
        title: "Image",
      },
    ];

    return (
      <div className={`markdown-editor ${className} ${isDragOver ? "drag-over" : ""}`}>
        <div className="markdown-toolbar d-flex flex-wrap align-items-center">
          {toolbarButtons.map((btn, index) =>
            btn.divider ? (
              <div key={index} className="toolbar-divider" />
            ) : (
              <button
                key={index}
                type="button"
                className="markdown-toolbar-item"
                onClick={btn.action}
                title={btn.title}
              >
                <FontAwesomeIcon icon={btn.icon!} />
              </button>
            )
          )}
        </div>
        <textarea
          ref={textareaRef}
          className="form-control markdown-textarea"
          value={content}
          onChange={handleChange}
          onDrop={handleDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          rows={15}
        />
        {/* Hidden input for form submission */}
        <input type="hidden" name="content" value={content} />
      </div>
    );
  }
);

export default MarkdownEditor;
