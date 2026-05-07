import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import { TagsInput, TagsInputHandle } from "../common/TagsInput";
import { RefinedDatePicker } from "../common/RefinedDatePicker";
import { doPut } from "../utils/reactUtils";

export interface EditTodoInfo {
  uuid?: string;
  name?: string;
  priority?: number;
  note?: string;
  tags?: string[];
  url?: string | null;
  due_date?: Date | string | null;
}

interface EditTodoModalProps {
  open: boolean;
  onClose: () => void;
  editTodoUrl: string;
  tagSearchUrl: string;
  priorityList: [number, string, number?][];
  todoInfo: EditTodoInfo | null;
  onEdit?: (uuid: string) => void;
  onDelete?: (todoInfo: EditTodoInfo) => void;
}

function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

const PLACEHOLDER_UUID = "00000000-0000-0000-0000-000000000000";

export function EditTodoModal({
  open,
  onClose,
  editTodoUrl,
  tagSearchUrl,
  priorityList,
  todoInfo,
  onEdit,
  onDelete,
}: EditTodoModalProps) {
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<number>(2);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const tagsRef = useRef<TagsInputHandle>(null);

  // Re-seed local state from todoInfo every time the modal is (re-)opened.
  useEffect(() => {
    if (!open) return;
    setName(todoInfo?.name ?? "");
    setPriority(todoInfo?.priority ?? 2);
    setNote(todoInfo?.note ?? "");
    setTags(todoInfo?.tags ?? []);
    setUrl(todoInfo?.url ?? "");
    setDueDate(formatDateForInput(todoInfo?.due_date));
    const t = window.setTimeout(() => nameRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, todoInfo]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const canSubmit = name.trim().length > 0 && Boolean(todoInfo?.uuid);

  const submit = useCallback(() => {
    if (!canSubmit || !todoInfo?.uuid) return;
    const target = editTodoUrl.replace(PLACEHOLDER_UUID, todoInfo.uuid);
    doPut(
      target,
      {
        todo_uuid: todoInfo.uuid,
        name,
        priority,
        note,
        tags: tags.join(","),
        url,
        due_date: dueDate,
      },
      response => {
        onEdit?.(response.data.uuid);
        onClose();
      },
      "Todo edited"
    );
  }, [canSubmit, editTodoUrl, todoInfo, name, priority, note, tags, url, dueDate, onEdit, onClose]);

  const handleDelete = () => {
    if (!todoInfo) return;
    onDelete?.(todoInfo);
    onClose();
  };

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
        aria-label="edit todo"
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Edit todo</h2>

        <div className="refined-field">
          <label htmlFor="todo-edit-name">name</label>
          <input
            ref={nameRef}
            id="todo-edit-name"
            type="text"
            autoComplete="off"
            maxLength={200}
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
            <label htmlFor="todo-edit-priority">priority</label>
            <select
              id="todo-edit-priority"
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
            <label htmlFor="todo-edit-due-date">
              due date <span className="optional">· optional</span>
            </label>
            <RefinedDatePicker id="todo-edit-due-date" value={dueDate} onChange={setDueDate} />
          </div>
        </div>

        <div className="refined-field">
          <label htmlFor="todo-edit-note">
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
              id="todo-edit-note"
              placeholder="freeform — markdown supported. drag a link here to insert."
              value={note}
              onChange={e => setNote(e.target.value)}
              onInput={handleNoteInput}
            />
          </div>
        </div>

        <div className="refined-field">
          <label htmlFor="todo-edit-tags">
            tags <span className="optional">· optional</span>
          </label>
          <TagsInput
            ref={tagsRef}
            id="todo-edit-tags"
            searchUrl={tagSearchUrl}
            initialTags={tags}
            onTagsChanged={setTags}
          />
        </div>

        <div className="refined-field">
          <label htmlFor="todo-edit-url">
            url <span className="optional">· optional</span>
          </label>
          <input
            id="todo-edit-url"
            type="text"
            autoComplete="off"
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
        </div>

        <div className="refined-modal-actions">
          <button type="button" className="refined-btn danger" onClick={handleDelete}>
            <FontAwesomeIcon icon={faTrashAlt} className="refined-btn-icon" />
            delete
          </button>
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="submit" className="refined-btn primary" disabled={!canSubmit}>
            save <span className="kbd">⏎</span>
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}

export default EditTodoModal;
