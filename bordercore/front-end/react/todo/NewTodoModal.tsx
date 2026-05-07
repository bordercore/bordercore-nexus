import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { TagsInput, TagsInputHandle } from "../common/TagsInput";
import { RefinedDatePicker } from "../common/RefinedDatePicker";
import { doPost } from "../utils/reactUtils";

interface NewTodoModalProps {
  open: boolean;
  onClose: () => void;
  createTodoUrl: string;
  tagSearchUrl: string;
  priorityList: [number, string, number?][];
  initialTags?: string[];
  initialPriority?: number;
  onAdd?: (uuid: string) => void;
}

export function NewTodoModal({
  open,
  onClose,
  createTodoUrl,
  tagSearchUrl,
  priorityList,
  initialTags,
  initialPriority,
  onAdd,
}: NewTodoModalProps) {
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<number>(initialPriority ?? 2);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>(initialTags ?? []);
  const [url, setUrl] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const tagsRef = useRef<TagsInputHandle>(null);

  // Reset state every time the modal opens. Mirrors NewNodeModal.
  useEffect(() => {
    if (!open) return;
    setName("");
    setPriority(initialPriority ?? 2);
    setNote("");
    setTags(initialTags ?? []);
    setUrl("");
    setDueDate("");
    const t = window.setTimeout(() => nameRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, initialPriority, initialTags]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const canSubmit = name.trim().length > 0;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    doPost(
      createTodoUrl,
      {
        name,
        priority,
        note,
        tags: tags.join(","),
        url,
        due_date: dueDate,
      },
      response => {
        onAdd?.(response.data.uuid);
        onClose();
      },
      "Todo task created."
    );
  }, [canSubmit, createTodoUrl, name, priority, note, tags, url, dueDate, onAdd, onClose]);

  const handleNoteInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = "";
    target.style.height = `${target.scrollHeight + 3}px`;
  };

  const handleLinkDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const dropped = event.dataTransfer.getData("URL");
    if (!dropped) return;
    const link = `[link](${dropped})`;
    const textarea = noteRef.current;
    if (!textarea) return;
    const next = `${textarea.value}${link}`;
    textarea.value = next;
    const idx = next.indexOf(link);
    textarea.setSelectionRange(idx + 1, idx + 5);
    setNote(next);
  };

  if (!open) return null;

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        className="refined-modal"
        role="dialog"
        aria-label="create new todo"
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Create a todo</h2>

        <div className="refined-field">
          <label htmlFor="todo-new-name">name</label>
          <input
            ref={nameRef}
            id="todo-new-name"
            type="text"
            autoComplete="off"
            maxLength={200}
            placeholder="e.g. ship Q2 review notes"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            required
          />
        </div>

        <div className="refined-row-2">
          <div className="refined-field">
            <label htmlFor="todo-new-priority">priority</label>
            <select
              id="todo-new-priority"
              value={priority}
              onChange={e => setPriority(parseInt(e.target.value, 10))}
            >
              {priorityList.map(p => (
                <option key={p[0]} value={p[0]}>
                  {p[1]}
                </option>
              ))}
            </select>
          </div>
          <div className="refined-field">
            <label htmlFor="todo-new-due-date">
              due date <span className="optional">· optional</span>
            </label>
            <RefinedDatePicker id="todo-new-due-date" value={dueDate} onChange={setDueDate} />
          </div>
        </div>

        <div className="refined-field">
          <label htmlFor="todo-new-note">
            note <span className="optional">· optional</span>
          </label>
          <div
            className={isDragOver ? "over" : undefined}
            onDragOver={e => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={e => {
              e.preventDefault();
              setIsDragOver(false);
            }}
            onDrop={handleLinkDrop}
          >
            <textarea
              ref={noteRef}
              id="todo-new-note"
              placeholder="freeform — markdown supported. drag a link here to insert."
              value={note}
              onChange={e => setNote(e.target.value)}
              onInput={handleNoteInput}
            />
          </div>
        </div>

        <div className="refined-field">
          <label htmlFor="todo-new-tags">
            tags <span className="optional">· optional</span>
          </label>
          <TagsInput
            ref={tagsRef}
            id="todo-new-tags"
            searchUrl={tagSearchUrl}
            initialTags={tags}
            onTagsChanged={setTags}
          />
        </div>

        <div className="refined-field">
          <label htmlFor="todo-new-url">
            url <span className="optional">· optional</span>
          </label>
          <input
            id="todo-new-url"
            type="text"
            autoComplete="off"
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
        </div>

        <div className="refined-modal-actions">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="submit" className="refined-btn primary" disabled={!canSubmit}>
            <FontAwesomeIcon icon={faPlus} className="refined-btn-icon" />
            create todo <span className="kbd">⏎</span>
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}

export default NewTodoModal;
