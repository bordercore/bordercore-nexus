import React, { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComment, faPencilAlt, faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import MarkdownIt from "markdown-it";
import { EventBus, doPost } from "../../utils/reactUtils";

interface DescriptionCardProps {
  description: string;
  note: string;
  exerciseUuid: string;
  editNoteUrl: string;
}

const markdown = new MarkdownIt();

export function DescriptionCard({
  description,
  note: initialNote,
  exerciseUuid,
  editNoteUrl,
}: DescriptionCardProps) {
  const [note, setNote] = useState<string>(initialNote);
  const [draft, setDraft] = useState<string>(initialNote);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasDescription = description.trim().length > 0;
  const hasNote = note.trim().length > 0;

  const noteHtml = useMemo(() => (hasNote ? markdown.render(note) : ""), [hasNote, note]);

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
    }
  }, [isEditing]);

  function saveNote(next: string) {
    const trimmed = next;
    if (trimmed === note) return;
    setNote(trimmed);
    doPost(editNoteUrl, { uuid: exerciseUuid, note: trimmed }, () => {}, "", "Error saving note");
  }

  function handleToggleEdit() {
    if (isEditing) {
      saveNote(draft);
      setIsEditing(false);
    } else {
      setDraft(note);
      setIsEditing(true);
    }
  }

  function handleBlur() {
    if (!isEditing) return;
    saveNote(draft);
    setIsEditing(false);
  }

  function handleDelete() {
    if (!hasNote) return;
    saveNote("");
    setDraft("");
    setIsEditing(false);
  }

  function handleAskAi() {
    EventBus.$emit("chat", { exerciseUuid });
  }

  const pencilTitle = hasNote ? "edit note" : "add note";

  return (
    <div className="ex-card">
      <h3>
        <span>description</span>
        <span className="ex-card-actions">
          <button
            type="button"
            className={`ex-icon-btn ${isEditing ? "active" : ""}`}
            onClick={handleToggleEdit}
            title={pencilTitle}
            aria-label={pencilTitle}
            aria-pressed={isEditing}
          >
            <FontAwesomeIcon icon={faPencilAlt} />
          </button>
          {hasNote && !isEditing && (
            <button
              type="button"
              className="ex-icon-btn danger"
              onClick={handleDelete}
              title="delete note"
              aria-label="delete note"
            >
              <FontAwesomeIcon icon={faTrashAlt} />
            </button>
          )}
          <button
            type="button"
            className="ex-icon-btn"
            onClick={handleAskAi}
            title="ask ai about this exercise"
            aria-label="ask ai"
          >
            <FontAwesomeIcon icon={faComment} />
          </button>
        </span>
      </h3>
      {hasDescription ? (
        <p className="ex-description">{description}</p>
      ) : (
        <p className="ex-no-description">no description</p>
      )}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          className="ex-note-editor"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
          placeholder="coach note — markdown supported"
          rows={4}
        />
      ) : (
        hasNote && (
          <div className="ex-note ex-note-md" dangerouslySetInnerHTML={{ __html: noteHtml }} />
        )
      )}
    </div>
  );
}
